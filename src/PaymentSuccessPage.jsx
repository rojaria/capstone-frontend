import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ref, set, update, remove, push, get } from "firebase/database";
import { database, auth } from "./firebase";
import { signOut } from "firebase/auth";

// 결제 성공 페이지
export default function PaymentSuccessPage({ user }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderData, setOrderData] = useState(null);

  useEffect(() => {
    let isProcessing = false; // 중복 실행 방지 플래그

    const processPayment = async () => {
      // 이미 처리 중이면 무시
      if (isProcessing) {
        console.log("이미 결제 처리 중입니다.");
        return;
      }

      isProcessing = true;

      try {
        // URL 파라미터에서 결제 정보 가져오기
        const orderId = searchParams.get("orderId");
        const paymentKey = searchParams.get("paymentKey");
        const amount = searchParams.get("amount");

        if (!orderId || !paymentKey || !amount) {
          throw new Error("결제 정보가 올바르지 않습니다.");
        }

        console.log("결제 승인 중...", { orderId, paymentKey, amount });

        // 토스페이먼츠 결제 승인 API 호출
        const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa((import.meta.env.VITE_TOSS_SECRET_KEY || "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6") + ":")}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            orderId,
            paymentKey,
            amount: parseInt(amount)
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "결제 승인에 실패했습니다.");
        }

        const paymentData = await response.json();
        console.log("결제 승인 성공:", paymentData);

        // Firebase에서 주문 정보 조회
        const orderRef = ref(database, `users/${user.uid}/orderHistory/${orderId}`);
        const orderSnapshot = await get(orderRef);

        if (!orderSnapshot.exists()) {
          throw new Error("주문 정보를 찾을 수 없습니다.");
        }

        const order = orderSnapshot.val();

        // 주문 상태 업데이트
        await update(orderRef, {
          status: "completed",
          paymentKey: paymentKey,
          paymentMethod: paymentData.method,
          completedAt: Date.now(),
          tossPaymentData: paymentData
        });

        // 재고 감소 처리
        for (const item of order.items) {
          if (item.barcode) {
            const productRef = ref(database, `products/${item.barcode}`);
            const productSnapshot = await get(productRef);

            if (productSnapshot.exists()) {
              const productData = productSnapshot.val();
              const newStock = (productData.stock || 0) - item.quantity;

              await update(productRef, {
                stock: Math.max(0, newStock),
                inStock: newStock > 0,
                updatedAt: Date.now()
              });
            }
          }
        }

        // 포인트 차감
        if (order.usedPoints > 0) {
          const userPointsRef = ref(database, `users/${user.uid}/points`);
          const pointsSnapshot = await get(userPointsRef);
          const currentPoints = pointsSnapshot.val() || 0;

          await set(userPointsRef, currentPoints - order.usedPoints);

          // 포인트 사용 내역 저장
          const pointHistoryRef = push(ref(database, `users/${user.uid}/pointHistory`));
          await set(pointHistoryRef, {
            amount: -order.usedPoints,
            type: "used",
            reason: "purchase",
            orderId: orderId,
            timestamp: Date.now()
          });
        }

        // 카트 비우기
        const cartNumberRef = ref(database, `users/${user.uid}/cartNumber`);
        const cartNumberSnapshot = await get(cartNumberRef);
        const cartNumber = cartNumberSnapshot.val();

        if (cartNumber) {
          const cartRef = ref(database, `carts/${cartNumber}/items`);
          await remove(cartRef);
        }

        setOrderData({ ...order, orderId, paymentData });
        setLoading(false);

      } catch (err) {
        console.error("결제 처리 오류:", err);
        
        // S008 오류(중복 요청)는 이미 처리된 것이므로 성공으로 간주
        if (err.message && err.message.includes("[S008]")) {
          console.log("이미 처리된 결제입니다. 주문 정보를 조회합니다...");
          
          // Firebase에서 주문 정보 조회
          try {
            const orderId = searchParams.get("orderId");
            const orderRef = ref(database, `users/${user.uid}/orderHistory/${orderId}`);
            const orderSnapshot = await get(orderRef);
            
            if (orderSnapshot.exists()) {
              const order = orderSnapshot.val();
              setOrderData({ ...order, orderId });
              setLoading(false);
              return; // 성공으로 처리
            }
          } catch (queryError) {
            console.error("주문 조회 오류:", queryError);
          }
        }
        
        setError(err.message);
        setLoading(false);
      }
    };

    if (user) {
      processPayment();
    }

    // cleanup 함수
    return () => {
      isProcessing = false;
    };
  }, [user, searchParams]);

  const handleComplete = async () => {
    try {
      // 카트 정리
      const cartNumberRef = ref(database, `users/${user.uid}/cartNumber`);
      const cartNumberSnapshot = await get(cartNumberRef);
      const cartNumber = cartNumberSnapshot.val();

      if (cartNumber) {
        const cartRef = ref(database, `carts/${cartNumber}`);
        await update(cartRef, {
          inUse: false,
          userId: null,
          releasedAt: Date.now()
        });

        await set(cartNumberRef, null);
      }

      // 로그아웃
      await signOut(auth);
    } catch (error) {
      console.error("로그아웃 오류:", error);
      await signOut(auth);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">결제 처리 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex items-center justify-center p-4 py-20">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="w-20 h-20 bg-red-500 rounded-full mx-auto flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">결제 실패</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate("/checkout")}
              className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-center p-4 py-20 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          {/* 성공 아이콘 */}
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-500 rounded-full mx-auto flex items-center justify-center animate-bounce">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-800 mb-2">결제 완료!</h2>
          <p className="text-xl text-green-600 font-semibold mb-2">
            이용해주셔서 감사합니다 🙏
          </p>
          <p className="text-gray-600 mb-6">
            결제가 성공적으로 완료되었습니다
          </p>

          {/* 영수증 */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
            <div className="border-b border-gray-200 pb-3 mb-3">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">주문번호</span>
                <span className="text-sm font-mono font-semibold">{orderData?.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">결제일시</span>
                <span className="text-sm">{new Date().toLocaleString('ko-KR')}</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-sm text-gray-600">결제수단</span>
                <span className="text-sm font-semibold">
                  {orderData?.paymentData?.method === 'CARD' && '카드'}
                  {orderData?.paymentData?.method === 'VIRTUAL_ACCOUNT' && '가상계좌'}
                  {orderData?.paymentData?.method === 'TRANSFER' && '계좌이체'}
                  {orderData?.paymentData?.method === 'MOBILE_PHONE' && '휴대폰'}
                </span>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">상품 금액</span>
                <span>{orderData?.total?.toLocaleString()}원</span>
              </div>
              {orderData?.usedPoints > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">포인트 할인</span>
                  <span className="text-red-600">-{orderData?.discount?.toLocaleString()}원</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-700">최종 결제금액</span>
                <span className="text-2xl font-bold text-blue-600">
                  {orderData?.finalAmount?.toLocaleString()}원
                </span>
              </div>
            </div>
          </div>

          {/* 추가 정보 */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 text-left">
            <p className="text-sm text-blue-800">
              ✅ 실제 결제가 완료되었습니다<br/>
              ✅ 재고가 자동으로 차감되었습니다<br/>
              ✅ 주문 내역에서 확인 가능합니다
            </p>
          </div>

          {/* 안내 메시지 */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 text-left">
            <p className="text-sm text-yellow-800">
              💡 확인 버튼을 누르면 자동으로 로그아웃됩니다<br/>
              카트가 초기화되어 다음 고객이 이용 가능합니다
            </p>
          </div>

          {/* 확인 버튼 */}
          <button
            onClick={handleComplete}
            className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold text-lg"
          >
            확인 (로그아웃)
          </button>
        </div>
      </div>
    </div>
  );
}

