// React 라이브러리에서 필요한 기능들 가져오기
import React, { useEffect, useState } from "react";
// Firebase 인증 관련 기능 가져오기
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, database } from "./firebase";
import { ref, onValue, set, update, remove } from "firebase/database";
// 다른 컴포넌트들 가져오기
import SignUp from "./SignUp.jsx";
import LoginPage from "./LoginPage.jsx";
import CartPage from "./CartPage.jsx";
import CheckoutPage from "./CheckoutPage.jsx";
// 새로운 페이지들 추가
import CartRegistrationPage from "./CartRegistrationPage.jsx";
import PointsPage from "./PointsPage.jsx";
import CheckoutPageNew from "./CheckoutPageNew.jsx";
// import ProductManagementPage from "./ProductManagementPage.jsx"; // 주석처리됨
import PaymentSuccessPage from "./PaymentSuccessPage.jsx";
import PaymentFailPage from "./PaymentFailPage.jsx";
// 페이지 이동을 위한 라우팅 기능 가져오기
import { Routes, Route, Link, useNavigate } from "react-router-dom";

// 메인 앱 컴포넌트
export default function App() {
  // 페이지 이동 함수
  const navigate = useNavigate();
  // user: 현재 로그인한 사용자 정보 저장
  const [user, setUser] = useState(undefined); // undefined = 로딩 중, null = 로그아웃
  // loading: 로그인 상태 확인 중인지 여부
  const [loading, setLoading] = useState(true);
  // showLogin: 로그인 화면을 보여줄지, 회원가입 화면을 보여줄지 결정
  const [showLogin, setShowLogin] = useState(true);
  // cartNumber: 현재 등록된 카트 번호 (초기값을 localStorage에서 불러옴)
  const [cartNumber, setCartNumber] = useState(() => {
    const saved = localStorage.getItem('cartNumber');
    console.log("🔄 App.jsx 초기화 - localStorage에서 카트넘버 불러오기:", saved);
    return saved || null;
  });
  // cartLoading: 카트 정보 로딩 중
  const [cartLoading, setCartLoading] = useState(true);

  // 컴포넌트가 처음 실행될 때 한 번만 실행됨
  useEffect(() => {
    // Firebase에서 로그인 상태 변화를 계속 감지
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      console.log("🔐 Firebase 인증 상태 변경:", currentUser?.uid || "로그아웃");
      
      // 새로고침 시 일시적인 null 상태를 방지하기 위해 약간의 지연 추가
      if (currentUser) {
        setUser(currentUser); // 로그인한 사용자 정보 저장
        setLoading(false); // 로딩 끝
        console.log("✅ 사용자 로그인 감지:", currentUser.uid);
        
        // 로그인 후 홈페이지(장바구니)로 리다이렉트
        if (window.location.pathname !== '/' && window.location.pathname !== '/points' && window.location.pathname !== '/checkout' && window.location.pathname !== '/products') {
          console.log("🏠 로그인 후 홈페이지로 리다이렉트");
          navigate('/', { replace: true });
        }
      } else {
        // 로그아웃 상태이지만 즉시 초기화하지 않고 잠시 대기
        setTimeout(async () => {
          console.log("🚪 사용자 로그아웃 감지 - 카트 정보 초기화");
          
          // Firebase의 카트 데이터도 삭제
          const savedCartNumber = localStorage.getItem('cartNumber');
          if (savedCartNumber) {
            try {
              const cartItemsRef = ref(database, `carts/${savedCartNumber}/items`);
              await remove(cartItemsRef);
              console.log("🗑️ Firebase 카트 데이터 삭제 완료:", savedCartNumber);
            } catch (error) {
              console.error("카트 데이터 삭제 오류:", error);
            }
          }
          
          // State 초기화
          setUser(null); // null = 로그아웃 상태
          setLoading(false);
          setCartNumber(null);
          setCartLoading(false);
          
          // localStorage 정리
          localStorage.removeItem('cartNumber');
          localStorage.removeItem('userId');
          console.log("🗑️ localStorage 카트넘버 정보 정리 완료");
        }, 100); // 100ms 지연
      }
    });
    // 컴포넌트가 사라질 때 감지 중지
    return () => unsub();
  }, []);

  // 사용자가 로그인하면 카트 번호 실시간 감지
  useEffect(() => {
    // Firebase 인증이 아직 로딩 중이면 대기
    if (user === undefined) {
      console.log("⏳ App.jsx Firebase 인증 로딩 중...");
      return;
    }
    
    if (!user) {
      setCartLoading(false);
      return;
    }

    console.log("🔍 App.jsx 카트넘버 조회 시작:", user.uid);
    setCartLoading(true);
    
    const cartRef = ref(database, `users/${user.uid}/cartNumber`);
    const unsubscribe = onValue(cartRef, (snapshot) => {
      const newCartNumber = snapshot.val();
      console.log("📋 App.jsx Firebase에서 카트넘버 조회:", newCartNumber);
      
      if (newCartNumber) {
        setCartNumber(newCartNumber);
        // localStorage에도 저장하여 새로고침 후에도 유지
        localStorage.setItem('cartNumber', newCartNumber);
        localStorage.setItem('userId', user.uid);
        console.log("💾 App.jsx 카트넘버 localStorage 저장:", newCartNumber);
      } else {
        // Firebase에 카트넘버가 없으면 localStorage에서 복원 시도
        const savedCartNumber = localStorage.getItem('cartNumber');
        const savedUserId = localStorage.getItem('userId');
        
        if (savedCartNumber && savedUserId === user.uid) {
          console.log("🔄 App.jsx localStorage에서 카트넘버 복원:", savedCartNumber);
          setCartNumber(savedCartNumber);
        } else {
          console.log("❌ App.jsx 카트넘버 없음 - 카트 등록 필요");
          setCartNumber(null);
        }
      }
      
      setCartLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 🔥 브라우저 종료 시 자동으로 카트 정리
  useEffect(() => {
    if (!user || !cartNumber) return;

    const handleBeforeUnload = async (e) => {
      // 카트 정리 (비동기지만 최선을 다해 실행)
      cleanupCart(cartNumber, user.uid);
      
      // 브라우저 종료 확인 메시지 (선택사항)
      // e.preventDefault();
      // e.returnValue = '';
    };

    // 페이지 언로드 이벤트 등록
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup: 이벤트 리스너 제거
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, cartNumber]);

  // 로딩 중이면 "로딩 중..." 메시지 표시
  if (loading || cartLoading) {
    console.log("⏳ 앱 로딩 중:", { loading, cartLoading });
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center text-lg">로딩 중...</div>
      </div>
    );
  }

  // 로그인하지 않은 경우 - 로그인/회원가입 화면 표시
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-auto max-w-md">
          <div className="card">
            <h2 className="text-xl font-bold mb-4 text-center">로그인</h2>
            {/* showLogin이 true면 로그인 화면, false면 회원가입 화면 */}
            {showLogin ? (
              <>
                <LoginPage />
                <p className="auth-toggle">
                  계정이 없으신가요?{" "}
                  {/* 회원가입 버튼 클릭 시 회원가입 화면으로 전환 */}
                  <button onClick={() => setShowLogin(false)}>회원가입</button>
                </p>
              </>
            ) : (
              <>
                <SignUp />
                <p className="auth-toggle">
                  이미 계정이 있으신가요?{" "}
                  {/* 로그인 버튼 클릭 시 로그인 화면으로 전환 */}
                  <button onClick={() => setShowLogin(true)}>로그인</button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 카트 정리 함수 (로그아웃, 브라우저 종료 시 공통 사용)
  const cleanupCart = async (currentCartNumber, currentUserId) => {
    if (!currentCartNumber && !currentUserId) return;

    try {
      // 1. 카트의 센서 데이터(items) 삭제
      if (currentCartNumber) {
        const cartItemsRef = ref(database, `carts/${currentCartNumber}/items`);
        await remove(cartItemsRef);
        console.log(`🗑️ 카트 ${currentCartNumber}의 센서 데이터 삭제 완료`);

        // 2. 카트 상태 업데이트 (사용 중 해제)
        const cartRef = ref(database, `carts/${currentCartNumber}`);
        await update(cartRef, {
          inUse: false,
          userId: null,
          releasedAt: Date.now()
        });
      }

      // 3. 사용자의 장바구니 데이터 삭제
      if (currentUserId) {
        const userCartRef = ref(database, `users/${currentUserId}/cart`);
        await remove(userCartRef);
        console.log(`🗑️ 사용자 ${currentUserId}의 장바구니 데이터 삭제 완료`);

        // 4. 사용자 카트 번호 제거
        const userCartNumberRef = ref(database, `users/${currentUserId}/cartNumber`);
        await set(userCartNumberRef, null);
      }

      console.log(`✅ 카트 ${currentCartNumber} 정리 완료`);
    } catch (error) {
      console.error("카트 정리 오류:", error);
    }
  };

  // 로그아웃 처리 함수
  const handleLogout = async () => {
    try {
      // 카트 정리
      await cleanupCart(cartNumber, user?.uid);

      // 로그아웃
      await signOut(auth);
    } catch (error) {
      console.error("로그아웃 오류:", error);
      alert("로그아웃 중 오류가 발생했습니다.");
    }
  };

  // 전체 앱을 중앙 정렬하는 부모 컨테이너
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-auto max-w-6xl">
        {user && !cartNumber ? (
          // 로그인했지만 카트 미등록 → 카트 입력 화면
          <>
            {/* 상단 바 */}
            <nav className="bg-white shadow-md rounded-lg mb-6 p-4">
              <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-gray-700">🛒 스마트 쇼핑 카트</h1>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">{user.email} 님</span>
                  <button 
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition" 
                    onClick={handleLogout}
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            </nav>
            {/* 카트 등록 화면 */}
            <CartRegistrationPage user={user} />
          </>
        ) : (
          // 로그인 & 카트 등록 완료 → 메인 화면 표시
          <>
            {/* 상단 네비게이션 바 */}
            <nav className="bg-white shadow-md rounded-lg mb-6 p-4">
              <div className="flex justify-between items-center">
                {/* 좌측: 메뉴 링크들 */}
                <div className="flex gap-6 ml-4">
                  <Link to="/" className="text-gray-600 hover:text-gray-800 font-medium transition">
                     장바구니
                  </Link>
                  <Link to="/points" className="text-gray-600 hover:text-gray-800 font-medium transition">
                     포인트
                  </Link>
                  {/* 상품 관리 링크 (주석처리됨) */}
                  {/* 
                  <Link to="/products" className="text-gray-600 hover:text-gray-800 font-medium transition">
                     상품 관리
                  </Link>
                  */}
                </div>
                {/* 우측: 사용자 정보 & 카트 번호 & 로그아웃 */}
                <div className="flex items-center gap-4 ml-12">
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium transition">
                    카트 {cartNumber}번
                  </span>
                  <span className="text-sm text-gray-600">{user.email} 님</span>
                  <button 
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition" 
                    onClick={handleLogout}
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            </nav>
            {/* 페이지 라우팅 설정 */}
            <Routes>
              {/* "/" 경로 - 장바구니 페이지 */}
              <Route path="/" element={<CartPage user={user} />} />
              {/* "/points" 경로 - 포인트 페이지 */}
              <Route path="/points" element={<PointsPage user={user} />} />
              {/* "/checkout" 경로 - 새로운 결제 페이지 */}
              <Route path="/checkout" element={<CheckoutPageNew user={user} />} />
              {/* "/payment-success" 경로 - 결제 성공 페이지 */}
              <Route path="/payment-success" element={<PaymentSuccessPage user={user} />} />
              {/* "/payment-fail" 경로 - 결제 실패 페이지 */}
              <Route path="/payment-fail" element={<PaymentFailPage />} />
              {/* "/products" 경로 - 상품 관리 페이지 (주석처리됨) */}
              {/* <Route path="/products" element={<ProductManagementPage />} /> */}
            </Routes>
          </>
        )}
      </div>
    </div>
  );
}
