const { onRequest, onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const fetch = require("node-fetch");

// Firebase Admin 초기화
admin.initializeApp();
const db = admin.database();

// 글로벌 옵션 설정
setGlobalOptions({ 
  maxInstances: 10,
  region: "asia-northeast3" // 서울 리전
});

// ==========================================
// 1️⃣ 상품 관련 API
// ==========================================

/**
 * 바코드로 상품 정보 조회
 * GET /api/products/:barcode
 */
exports.getProduct = onRequest(async (req, res) => {
  // CORS 설정
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const barcode = req.query.barcode || req.params.barcode;
    
    if (!barcode) {
      res.status(400).json({ error: "바코드가 필요합니다." });
      return;
    }

    const snapshot = await db.ref(`products/${barcode}`).once("value");
    
    if (!snapshot.exists()) {
      res.status(404).json({ error: "상품을 찾을 수 없습니다." });
      return;
    }

    res.status(200).json({ 
      success: true, 
      product: snapshot.val() 
    });

  } catch (error) {
    logger.error("상품 조회 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

/**
 * 상품 스캔 후 장바구니에 추가
 * POST /api/cart/addScannedItem
 * Body: { userId, barcode, quantity }
 */
exports.addScannedItem = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const { userId, barcode, quantity = 1 } = req.body;

    if (!userId || !barcode) {
      res.status(400).json({ error: "userId와 barcode가 필요합니다." });
      return;
    }

    // 상품 정보 조회
    const productSnapshot = await db.ref(`products/${barcode}`).once("value");
    
    if (!productSnapshot.exists()) {
      res.status(404).json({ error: "존재하지 않는 상품입니다." });
      return;
    }

    const product = productSnapshot.val();

    // 재고 확인
    if (!product.inStock) {
      res.status(400).json({ error: "품절된 상품입니다." });
      return;
    }

    // 장바구니에 추가
    const cartRef = db.ref(`users/${userId}/cart`).push();
    await cartRef.set({
      name: product.name,
      price: product.price,
      quantity: quantity,
      barcode: barcode,
      addedAt: Date.now()
    });

    res.status(200).json({ 
      success: true, 
      message: "장바구니에 추가되었습니다.",
      product: product
    });

  } catch (error) {
    logger.error("장바구니 추가 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// ==========================================
// 2️⃣ 포인트 관련 API
// ==========================================

/**
 * 이동 거리 기반 포인트 지급
 * POST /api/points/addDistancePoints
 * Body: { userId, distance }
 */
exports.addDistancePoints = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const { userId, distance } = req.body;

    if (!userId || distance == null) {
      res.status(400).json({ error: "userId와 distance가 필요합니다." });
      return;
    }

    // 포인트 설정 조회 (10m당 1포인트)
    const configSnapshot = await db.ref("config/pointRules/distancePerPoint").once("value");
    const distancePerPoint = configSnapshot.val() || 10;

    // 포인트 계산
    const earnedPoints = Math.floor(distance / distancePerPoint);

    if (earnedPoints <= 0) {
      res.status(200).json({ 
        success: true, 
        message: "포인트 지급 기준에 미달합니다.",
        earnedPoints: 0
      });
      return;
    }

    // 현재 포인트 조회
    const userPointsRef = db.ref(`users/${userId}/points`);
    const currentPointsSnapshot = await userPointsRef.once("value");
    const currentPoints = currentPointsSnapshot.val() || 0;

    // 포인트 업데이트
    await userPointsRef.set(currentPoints + earnedPoints);

    // 총 이동거리 업데이트
    const totalDistanceRef = db.ref(`users/${userId}/totalDistance`);
    const totalDistanceSnapshot = await totalDistanceRef.once("value");
    const totalDistance = totalDistanceSnapshot.val() || 0;
    await totalDistanceRef.set(totalDistance + distance);

    // 포인트 내역 저장
    const pointHistoryRef = db.ref(`users/${userId}/pointHistory`).push();
    await pointHistoryRef.set({
      amount: earnedPoints,
      type: "earned",
      reason: "distance",
      distance: distance,
      timestamp: Date.now()
    });

    res.status(200).json({ 
      success: true, 
      message: `${earnedPoints} 포인트가 적립되었습니다!`,
      earnedPoints: earnedPoints,
      totalPoints: currentPoints + earnedPoints
    });

  } catch (error) {
    logger.error("포인트 지급 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

/**
 * 위치 기반 이벤트 포인트 지급
 * POST /api/points/checkLocationEvent
 * Body: { userId, x, y }
 */
exports.checkLocationEvent = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const { userId, x, y } = req.body;

    if (!userId || x == null || y == null) {
      res.status(400).json({ error: "userId, x, y가 필요합니다." });
      return;
    }

    // 활성화된 위치 이벤트 조회
    const eventsSnapshot = await db.ref("events/locationReward").once("value");
    const events = eventsSnapshot.val();

    if (!events) {
      res.status(200).json({ success: true, triggered: false });
      return;
    }

    let triggeredEvent = null;

    // 각 이벤트 확인
    for (const [eventId, event] of Object.entries(events)) {
      if (!event.enabled) continue;

      // 비콘 위치 조회
      const beaconSnapshot = await db.ref(`beacons/${event.beaconId}`).once("value");
      const beacon = beaconSnapshot.val();

      if (!beacon) continue;

      // 거리 계산
      const distance = Math.sqrt(
        Math.pow(x - beacon.x, 2) + Math.pow(y - beacon.y, 2)
      );

      // 반경 내에 있는지 확인
      if (distance <= event.radius) {
        triggeredEvent = { eventId, ...event, beacon };
        break;
      }
    }

    if (!triggeredEvent) {
      res.status(200).json({ success: true, triggered: false });
      return;
    }

    // 포인트 지급
    const userPointsRef = db.ref(`users/${userId}/points`);
    const currentPointsSnapshot = await userPointsRef.once("value");
    const currentPoints = currentPointsSnapshot.val() || 0;
    await userPointsRef.set(currentPoints + triggeredEvent.points);

    // 포인트 내역 저장
    const pointHistoryRef = db.ref(`users/${userId}/pointHistory`).push();
    await pointHistoryRef.set({
      amount: triggeredEvent.points,
      type: "earned",
      reason: "location_event",
      eventName: triggeredEvent.name,
      timestamp: Date.now()
    });

    res.status(200).json({ 
      success: true, 
      triggered: true,
      event: triggeredEvent.name,
      points: triggeredEvent.points,
      totalPoints: currentPoints + triggeredEvent.points
    });

  } catch (error) {
    logger.error("위치 이벤트 확인 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// ==========================================
// 3️⃣ 결제 관련 API
// ==========================================

/**
 * 결제 준비 (주문 생성)
 * POST /api/payment/prepare
 * Body: { userId, items, total, usedPoints }
 */
exports.preparePayment = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const { userId, items, total, usedPoints = 0 } = req.body;

    if (!userId || !items || total == null) {
      res.status(400).json({ error: "필수 정보가 누락되었습니다." });
      return;
    }

    // 사용자 포인트 확인
    const userPointsSnapshot = await db.ref(`users/${userId}/points`).once("value");
    const availablePoints = userPointsSnapshot.val() || 0;

    if (usedPoints > availablePoints) {
      res.status(400).json({ error: "포인트가 부족합니다." });
      return;
    }

    // 최종 결제 금액 계산
    const pointToWon = 10; // 1포인트 = 10원
    const discount = usedPoints * pointToWon;
    const finalAmount = total - discount;

    // 주문 생성
    const orderId = `ORDER_${Date.now()}_${userId.slice(0, 8)}`;
    const orderRef = db.ref(`users/${userId}/orderHistory/${orderId}`);
    
    await orderRef.set({
      items: items,
      total: total,
      usedPoints: usedPoints,
      discount: discount,
      finalAmount: finalAmount,
      status: "pending",
      createdAt: Date.now()
    });

    res.status(200).json({ 
      success: true, 
      orderId: orderId,
      finalAmount: finalAmount,
      discount: discount
    });

  } catch (error) {
    logger.error("결제 준비 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

/**
 * 결제 완료 처리
 * POST /api/payment/complete
 * Body: { userId, orderId, paymentMethod }
 */
exports.completePayment = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const { userId, orderId, paymentMethod } = req.body;

    if (!userId || !orderId) {
      res.status(400).json({ error: "userId와 orderId가 필요합니다." });
      return;
    }

    // 주문 정보 조회
    const orderRef = db.ref(`users/${userId}/orderHistory/${orderId}`);
    const orderSnapshot = await orderRef.once("value");

    if (!orderSnapshot.exists()) {
      res.status(404).json({ error: "주문을 찾을 수 없습니다." });
      return;
    }

    const order = orderSnapshot.val();

    // 포인트 차감
    if (order.usedPoints > 0) {
      const userPointsRef = db.ref(`users/${userId}/points`);
      const currentPointsSnapshot = await userPointsRef.once("value");
      const currentPoints = currentPointsSnapshot.val() || 0;
      await userPointsRef.set(currentPoints - order.usedPoints);

      // 포인트 사용 내역 저장
      const pointHistoryRef = db.ref(`users/${userId}/pointHistory`).push();
      await pointHistoryRef.set({
        amount: -order.usedPoints,
        type: "used",
        reason: "purchase",
        orderId: orderId,
        timestamp: Date.now()
      });
    }

    // 주문 상태 업데이트
    await orderRef.update({
      status: "completed",
      paymentMethod: paymentMethod,
      completedAt: Date.now()
    });

    // 장바구니 비우기
    const cartRef = db.ref(`users/${userId}/cart`);
    await cartRef.remove();

    res.status(200).json({ 
      success: true, 
      message: "결제가 완료되었습니다!",
      order: { orderId, ...order, status: "completed" }
    });

  } catch (error) {
    logger.error("결제 완료 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// ==========================================
// 4️⃣ 위치 관련 API
// ==========================================

/**
 * 카트 위치 업데이트
 * POST /api/location/update
 * Body: { userId, x, y }
 */
exports.updateLocation = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const { userId, x, y } = req.body;

    if (!userId || x == null || y == null) {
      res.status(400).json({ error: "userId, x, y가 필요합니다." });
      return;
    }

    // 사용자의 카트 번호 조회
    const cartNumberSnapshot = await db.ref(`users/${userId}/cartNumber`).once("value");
    const cartNumber = cartNumberSnapshot.val();

    if (!cartNumber) {
      res.status(400).json({ error: "등록된 카트가 없습니다." });
      return;
    }

    // 카트 위치 업데이트
    const cartRef = db.ref(`carts/${cartNumber}/lastLocation`);
    await cartRef.set({
      x: x,
      y: y,
      timestamp: Date.now()
    });

    res.status(200).json({ 
      success: true, 
      message: "위치가 업데이트되었습니다."
    });

  } catch (error) {
    logger.error("위치 업데이트 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// ==========================================
// 5️⃣ 관리자용 API (상품 등록)
// ==========================================

/**
 * 상품 등록/수정
 * POST /api/admin/addProduct
 * Body: { barcode, name, price, category, inStock }
 */
exports.addProduct = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const { barcode, name, price, category = "기타", inStock = true } = req.body;

    if (!barcode || !name || price == null) {
      res.status(400).json({ error: "바코드, 상품명, 가격이 필요합니다." });
      return;
    }

    // 상품 저장
    const productRef = db.ref(`products/${barcode}`);
    await productRef.set({
      name: name,
      price: price,
      category: category,
      inStock: inStock,
      updatedAt: Date.now()
    });

    res.status(200).json({ 
      success: true, 
      message: "상품이 등록되었습니다.",
      product: { barcode, name, price, category, inStock }
    });

  } catch (error) {
    logger.error("상품 등록 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// ==========================================
// 6️⃣ 결제 관련 API (토스페이먼츠)
// ==========================================

/**
 * 결제 승인 (서버 검증용)
 * POST /api/payment/confirm
 * Body: { orderId, paymentKey, amount }
 */
exports.confirmPayment = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const { orderId, paymentKey, amount } = req.body;

    if (!orderId || !paymentKey || !amount) {
      res.status(400).json({ error: "필수 정보가 누락되었습니다." });
      return;
    }

    // 토스페이먼츠 Secret Key (환경 변수에서 가져오기)
    // Firebase Functions 환경 변수 설정: firebase functions:config:set toss.secret_key="test_gsk_..."
    const secretKey = process.env.TOSS_SECRET_KEY || "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6";
    const authorization = Buffer.from(secretKey + ":").toString("base64");

    // 토스페이먼츠 결제 승인 API 호출
    const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        orderId,
        paymentKey,
        amount: parseInt(amount)
      })
    });

    const tossData = await tossResponse.json();

    if (!tossResponse.ok) {
      logger.error("토스페이먼츠 결제 승인 실패:", tossData);
      res.status(tossResponse.status).json({
        error: tossData.message || "결제 승인에 실패했습니다.",
        code: tossData.code
      });
      return;
    }

    logger.info("토스페이먼츠 결제 승인 성공:", tossData);

    res.status(200).json({
      success: true,
      data: tossData
    });

  } catch (error) {
    logger.error("결제 승인 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

/**
 * 결제 취소 (환불)
 * POST /api/payment/cancel
 * Body: { paymentKey, cancelReason }
 */
exports.cancelPayment = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const { paymentKey, cancelReason } = req.body;

    if (!paymentKey || !cancelReason) {
      res.status(400).json({ error: "paymentKey와 cancelReason이 필요합니다." });
      return;
    }

    const secretKey = process.env.TOSS_SECRET_KEY || "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6";
    const authorization = Buffer.from(secretKey + ":").toString("base64");

    // 토스페이먼츠 결제 취소 API 호출
    const tossResponse = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        cancelReason
      })
    });

    const tossData = await tossResponse.json();

    if (!tossResponse.ok) {
      logger.error("토스페이먼츠 결제 취소 실패:", tossData);
      res.status(tossResponse.status).json({
        error: tossData.message || "결제 취소에 실패했습니다.",
        code: tossData.code
      });
      return;
    }

    logger.info("토스페이먼츠 결제 취소 성공:", tossData);

    res.status(200).json({
      success: true,
      data: tossData
    });

  } catch (error) {
    logger.error("결제 취소 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});
