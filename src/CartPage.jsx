// React에서 필요한 기능들 가져오기
import React, { useEffect, useState } from "react";
// 페이지 이동 기능 가져오기
import { useNavigate } from "react-router-dom";
// Realtime Database 관련 기능 가져오기
import { ref, onValue, update, remove, push, set, get } from "firebase/database";
import { database, auth } from "./firebase";
import { signOut } from "firebase/auth";

// 장바구니 페이지 컴포넌트
export default function CartPage({ user }) {
  // 페이지 이동 함수
  const navigate = useNavigate();
  // cart: 장바구니 상품 목록 저장
  const [cart, setCart] = useState([]);
  // 상품별 재고 상태 저장
  const [productStockStatus, setProductStockStatus] = useState({});
  // 현재 사용자의 카트 번호 (초기값을 localStorage에서 불러옴)
  const [cartNumber, setCartNumber] = useState(() => {
    const saved = localStorage.getItem('cartNumber');
    console.log("🔄 CartPage 초기화 - localStorage에서 카트넘버 불러오기:", saved);
    return saved || null;
  });

  // 사용자의 카트 번호 조회
  useEffect(() => {
    // Firebase 인증이 아직 로딩 중이면 대기
    if (user === undefined) {
      console.log("⏳ CartPage Firebase 인증 로딩 중...");
      return;
    }
    
    if (!user) return;
    
    console.log("🔍 카트넘버 조회 시작:", user.uid);
    
    const cartNumberRef = ref(database, `users/${user.uid}/cartNumber`);
    const unsubscribe = onValue(cartNumberRef, (snapshot) => {
      const newCartNumber = snapshot.val();
      console.log("📋 Firebase에서 카트넘버 조회:", newCartNumber);
      
      if (newCartNumber) {
        setCartNumber(newCartNumber);
        // localStorage에도 저장하여 새로고침 후에도 유지
        localStorage.setItem('cartNumber', newCartNumber);
        localStorage.setItem('userId', user.uid);
        console.log("💾 카트넘버 localStorage 저장:", newCartNumber);
      } else {
        // Firebase에 카트넘버가 없으면 localStorage에서 복원 시도
        const savedCartNumber = localStorage.getItem('cartNumber');
        const savedUserId = localStorage.getItem('userId');
        
        if (savedCartNumber && savedUserId === user.uid) {
          console.log("🔄 localStorage에서 카트넘버 복원:", savedCartNumber);
          setCartNumber(savedCartNumber);
        } else {
          console.log("❌ 카트넘버 없음 - 카트 등록 필요");
          setCartNumber(null);
        }
      }
    });
    
    return () => unsubscribe();
  }, [user]);

  // 🔒 카트 사용 권한 실시간 검증
  useEffect(() => {
    // Firebase 인증이 아직 로딩 중이면 대기
    if (user === undefined) return;
    
    if (!user || !cartNumber) return;

    console.log("🔒 카트 권한 검증 시작:", { user: user.uid, cartNumber });

    const cartRef = ref(database, `carts/${cartNumber}`);
    const unsubscribe = onValue(cartRef, async (snapshot) => {
      if (snapshot.exists()) {
        const cartData = snapshot.val();
        
        // 다른 사용자가 이 카트를 탈취한 경우 (계정과 카트가 끊김)
        if (cartData.inUse && cartData.userId !== user.uid) {
          console.log("🚨 계정과 카트 연결 끊김 - 장바구니 데이터 초기화");
          
          // 장바구니 데이터 초기화
          setCart([]);
          
          // localStorage 정리
          localStorage.removeItem('cartNumber');
          localStorage.removeItem('userId');
          
          // 사용자에게 알림
          alert(
            `⚠️ 경고: 카트 ${cartNumber}번이 다른 사용자에 의해 사용되고 있습니다!\n\n` +
            `장바구니가 초기화되고 로그아웃됩니다.`
          );
          
          // 강제 로그아웃
          await signOut(auth);
          window.location.href = "/";
        }
        
        // 카트가 해제된 경우
        if (!cartData.inUse) {
          console.warn(`⚠️ 카트 ${cartNumber}번이 해제되었습니다.`);
        }
      } else {
        // 카트가 삭제된 경우
        console.log("🚨 카트 삭제됨 - 장바구니 데이터 초기화");
        setCart([]);
        alert(`⚠️ 카트 ${cartNumber}번이 시스템에서 제거되었습니다.\n장바구니가 초기화됩니다.`);
      }
    });

    return () => unsubscribe();
  }, [user, cartNumber]);

  // 컴포넌트가 실행되거나 user/cartNumber가 변경될 때마다 실행
  useEffect(() => {
    console.log("🔄 CartPage useEffect 실행:", { user: user?.uid, cartNumber });
    
    // Firebase 인증이 아직 로딩 중이면 대기
    if (user === undefined) {
      console.log("⏳ Firebase 인증 로딩 중...");
      return;
    }
    
    // 로그인하지 않았으면 종료
    if (!user) {
      console.log("❌ user 없음 - 로그인 필요");
      return;
    }
    
    // localStorage의 userId와 현재 user.uid가 다르면 카트넘버 초기화
    const savedUserId = localStorage.getItem('userId');
    if (savedUserId && savedUserId !== user.uid) {
      console.log("⚠️ 다른 사용자의 localStorage 발견 - 초기화");
      localStorage.removeItem('cartNumber');
      localStorage.removeItem('userId');
      setCartNumber(null);
      return;
    }
    
    // 카트 번호가 없으면 종료
    if (!cartNumber) {
      console.log("❌ cartNumber 없음:", cartNumber);
      return;
    }
    
    console.log("✅ CartPage 데이터 로드 시작:", { user: user.uid, cartNumber });
    
    const unsubscribers = [];
    
    // 🔥 카트 번호 기반으로 센서 데이터 읽기
    const cartRef = ref(database, `carts/${cartNumber}/items`);
    console.log("🔍 카트 센서 데이터 경로:", `carts/${cartNumber}/items`);
    

    // 실시간으로 장바구니 데이터 변화 감지
    const cartUnsubscribe = onValue(cartRef, 
      snapshot => {
        console.log("📡 Firebase 데이터 변경 감지");
        const data = snapshot.val();
        console.log("📦 받은 원본 데이터:", JSON.stringify(data, null, 2));
        
        let items = [];
        if (data) {
          // JSON 객체를 배열로 변환 (Firebase 키를 id로 사용)
          items = Object.keys(data).map(key => {
            console.log(`🔑 Firebase 키: ${key}, 데이터:`, data[key]);
            return { 
              id: key, // Firebase 키를 id로 사용 (barcode가 키로 사용됨)
              ...data[key] 
            };
          });
          console.log("📋 변환된 배열:", items);
          setCart(items);
        } else {
          console.log("📦 데이터가 없습니다 (null)");
          setCart([]);
        }
        
        // 🔍 각 상품의 재고 상태를 실시간으로 감지
        items.forEach(item => {
          if (item.barcode) {
            const productRef = ref(database, `products/${item.barcode}`);
            const productUnsubscribe = onValue(productRef, (snap) => {
              if (snap.exists()) {
                const productData = snap.val();
                setProductStockStatus(prev => ({
                  ...prev,
                  [item.barcode]: {
                    inStock: productData.inStock,
                    name: productData.name,
                    price: productData.price
                  }
                }));
              } else {
                // 상품 DB에 없으면 재고 없음
                setProductStockStatus(prev => ({
                  ...prev,
                  [item.barcode]: {
                    inStock: false,
                    name: item.name,
                    price: item.price
                  }
                }));
              }
            });
            unsubscribers.push(productUnsubscribe);
          }
        });
      },
      error => {
        console.error("❌ 데이터 읽기 오류:", error);
        alert("데이터 읽기 실패: " + error.message);
      }
    );
    
    // 컴포넌트가 사라질 때 모든 실시간 감지 중지
    return () => {
      console.log("🧹 CartPage cleanup 실행");
      cartUnsubscribe();
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, cartNumber]);

  // 수량 증가 함수 (+ 버튼)
  const increment = async (id, quantity) => {
    if (!cartNumber) return;
    // 카트의 센서 데이터에서 해당 상품의 수량을 1 증가
    const itemRef = ref(database, `carts/${cartNumber}/items/${id}`);
    await update(itemRef, { quantity: quantity + 1 });
  };

  // 수량 감소 함수 (- 버튼)
  const decrement = async (id, quantity) => {
    if (!cartNumber) return;
    // 수량이 1 이하면 감소하지 않음
    if (quantity <= 1) return;
    // 카트의 센서 데이터에서 해당 상품의 수량을 1 감소
    const itemRef = ref(database, `carts/${cartNumber}/items/${id}`);
    await update(itemRef, { quantity: quantity - 1 });
  };

  // 수량 직접 입력 함수
  const handleQuantityChange = async (id, qty) => {
    if (!cartNumber) return;
    // 1보다 작은 수는 1로 설정
    if (qty < 1) qty = 1;
    // 카트의 센서 데이터에서 해당 상품의 수량을 입력한 값으로 변경
    const itemRef = ref(database, `carts/${cartNumber}/items/${id}`);
    await update(itemRef, { quantity: qty });
  };

  // 상품 삭제 함수
  const handleRemove = async (id) => {
    if (!cartNumber) return;
    const itemRef = ref(database, `carts/${cartNumber}/items/${id}`);
    await remove(itemRef);
  };

  // 테스트 데이터 추가 함수 (센서 데이터 시뮬레이션)
  const addTestData = async () => {
    if (!cartNumber) {
      alert("❌ 카트 번호가 없습니다.");
      return;
    }
    
    try {
      // 💡 상품 관리 샘플 데이터와 동일한 상품들 추가 (센서가 감지한 것처럼)
      // 📦 전체 샘플 상품 목록:
      // 8801234567890 - 신라면 (3500원)
      // 8801234567891 - 삼양라면 (3000원)
      // 8801234567892 - 코카콜라 (1500원)
      // 8801234567893 - 사이다 (1500원)
      // 8801234567894 - 우유 (2500원)
      // 8801234567895 - 요구르트 (3000원)
      // 8801234567896 - 식빵 (2000원)
      // 8801234567897 - 과자 (1800원)
      // 8801234567898 - 초콜릿 (2200원)
      // 8801234567899 - 사과 (5000원)
      
      const items = [
        { barcode: "8801234567890", name: "신라면", price: 3500, quantity: 2, detectedAt: Date.now() },
        { barcode: "8801234567892", name: "코카콜라", price: 1500, quantity: 3, detectedAt: Date.now() },
        { barcode: "8801234567894", name: "우유", price: 2500, quantity: 1, detectedAt: Date.now() },
        { barcode: "8801234567897", name: "과자", price: 1800, quantity: 2, detectedAt: Date.now() },
        { barcode: "8801234567899", name: "사과", price: 5000, quantity: 1, detectedAt: Date.now() }
      ];
      
      // 각 상품을 고정 ID로 추가 (센서 데이터처럼)
      for (const item of items) {
        const itemRef = ref(database, `carts/${cartNumber}/items/${item.barcode}`);
        console.log(`🔄 저장 시도:`, { path: `carts/${cartNumber}/items/${item.barcode}`, data: item });
        
        try {
          await set(itemRef, item);
          console.log(`✅ 센서 데이터 저장 성공: ${item.name} (${item.barcode})`);
          
          // 저장 후 즉시 확인
          const verifyRef = ref(database, `carts/${cartNumber}/items/${item.barcode}`);
          const verifySnapshot = await get(verifyRef);
          if (verifySnapshot.exists()) {
            console.log(`✅ 저장 확인됨:`, verifySnapshot.val());
          } else {
            console.log(`❌ 저장 확인 실패: 데이터가 없습니다`);
          }
        } catch (error) {
          console.error(`❌ 저장 실패: ${item.name}`, error);
        }
      }
      
      alert(`✅ 카트 ${cartNumber}번에 센서 데이터 5개가 추가되었습니다!\n(실제 센서가 상품을 감지한 것처럼 동작)`);
    } catch (error) {
      console.error("센서 데이터 추가 오류:", error);
      alert("❌ 데이터 추가 실패: " + error.message);
    }
  };

  return (
    <div className="w-full">
      {/* 헤더 */}
      <div className="w-full border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-center gap-2 relative">
            <h1 className="text-lg sm:text-xl font-bold -ml-16 sm:-ml-20">장바구니</h1>
            {/* 센서 시뮬레이션 버튼 (테스트용) - 주석처리됨 */}
            {/* 
            <button
              onClick={addTestData}
              className="absolute right-0 px-2 sm:px-4 py-1.5 sm:py-2 border border-gray-300 hover:bg-gray-50 transition text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
            >
              센서 시뮬레이션
            </button>
            */}
          </div>
        </div>
      </div>

      {/* 카트 정보 */}
      <div className="w-full border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-gray-600 whitespace-nowrap">카트 번호</span>
              <span className="font-mono font-semibold">{cartNumber}</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-black rounded-full flex-shrink-0"></div>
              <span className="text-gray-600 text-xs sm:text-sm whitespace-nowrap">실시간 동기화</span>
            </div>
          </div>
        </div>
      </div>
      {/* 상품 목록 */}
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-12 sm:pb-16">
        {cart.length === 0 ? (
          <div className="text-center py-12 sm:py-20">
            <p className="text-gray-400 text-base sm:text-lg">장바구니가 비어있습니다</p>
          </div>
        ) : (
          <div className="space-y-0">
            {cart.map(item => {
              const stockInfo = item.barcode ? productStockStatus[item.barcode] : null;
              const isOutOfStock = stockInfo && stockInfo.inStock === false;
              
              return (
                <div 
                  key={item.id} 
                  className="border-b border-gray-100 py-4 sm:py-6"
                >
                  {/* 상품 정보 */}
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <input 
                        type="checkbox" 
                        defaultChecked 
                        className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-gray-300 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm sm:text-base font-medium truncate ${isOutOfStock ? 'text-gray-400 line-through' : 'text-black'}`}>
                          {item.name}
                        </p>
                        {isOutOfStock && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-black text-white text-xs">
                            품절
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1 hover:bg-gray-100 rounded transition flex-shrink-0 ml-2"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* 수량 및 가격 */}
                  <div className="flex items-center justify-between ml-6 sm:ml-8 gap-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">수량</span>
                      <div className="flex items-center border border-gray-300">
                        <button
                          onClick={() => decrement(item.id, item.quantity)}
                          className="w-7 h-7 sm:w-8 sm:h-8 hover:bg-gray-50 transition flex items-center justify-center"
                        >
                          <span className="text-base sm:text-lg">-</span>
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={item.quantity}
                          onChange={e => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                          className="w-10 sm:w-12 h-7 sm:h-8 text-center border-x border-gray-300 text-xs sm:text-sm"
                        />
                        <button
                          onClick={() => increment(item.id, item.quantity)}
                          className="w-7 h-7 sm:w-8 sm:h-8 hover:bg-gray-50 transition flex items-center justify-center"
                        >
                          <span className="text-base sm:text-lg">+</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-base sm:text-lg font-semibold whitespace-nowrap">{(item.price * item.quantity).toLocaleString()}원</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 하단 고정 요소를 위한 여백 */}
      {cart.length > 0 && (
        <div className="h-32 sm:h-36"></div>
      )}

      {/* 하단 고정 영역 */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            {/* 최종 가격 */}
            <div className="mb-3 sm:mb-4">
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">
                <span>상품가격</span>
                <span className="whitespace-nowrap">{cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                <span>배송비</span>
                <span className="whitespace-nowrap">0원</span>
              </div>
              <div className="flex items-center justify-between text-base sm:text-lg font-bold pt-2 sm:pt-3 border-t border-gray-200">
                <span>합계</span>
                <span className="whitespace-nowrap">{cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString()}원</span>
              </div>
            </div>

            {/* 결제 버튼 */}
            <button
              onClick={() => navigate("/checkout")}
              className="w-full py-3 sm:py-4 bg-black text-white text-sm sm:text-base font-medium hover:bg-gray-800 transition"
            >
              구매하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
