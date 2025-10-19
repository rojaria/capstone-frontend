// React에서 필요한 기능들 가져오기
import React, { useEffect, useState } from "react";
// 페이지 이동 기능 가져오기
import { useNavigate } from "react-router-dom";
// Realtime Database 관련 기능 가져오기
import { ref, onValue } from "firebase/database";
import { database } from "./firebase";

// 키오스크 장바구니 페이지 컴포넌트 (읽기 전용)
export default function KioskCartPage() {
  const navigate = useNavigate(); // 페이지 이동 기능
  const kioskUserId = sessionStorage.getItem("kioskUserId"); // 세션에서 사용자 ID 가져오기
  // cart: 장바구니 상품 목록 저장
  const [cart, setCart] = useState([]);

  // 컴포넌트가 실행되거나 kioskUserId가 변경될 때마다 실행
  useEffect(() => {
    // 키오스크 사용자 ID가 없으면 로그인 페이지로 이동
    if (!kioskUserId) {
      navigate("/kiosk-login", { replace: true });
      return;
    }
    // Realtime Database에서 해당 사용자의 장바구니 데이터 위치 지정
    const cartRef = ref(database, `users/${kioskUserId}/cart`);
    // 실시간으로 장바구니 데이터 변화 감지
    const unsubscribe = onValue(cartRef, snapshot => {
      const data = snapshot.val();
      // JSON 객체를 배열로 변환
      const items = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      setCart(items); // 장바구니 상태 업데이트
    });
    // 컴포넌트가 사라질 때 실시간 감지 중지
    return () => unsubscribe();
  }, [kioskUserId, navigate]);

  // 총 결제금액 계산
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="max-w-3xl mx-auto mt-10">
      {/* 상단 네비게이션 바 */}
      <div className="navbar">
        <span className="font-semibold">키오스크 모드</span>
        {/* 로그아웃 버튼 - 세션 삭제 후 키오스크 로그인 페이지로 이동 */}
        <button className="btn-red" onClick={() => { sessionStorage.removeItem("kioskUserId"); navigate("/kiosk-login"); }}>로그아웃</button>
      </div>
      <h2 className="text-2xl font-bold mb-4">장바구니</h2>
      {/* 장바구니가 비어있으면 메시지 표시, 있으면 목록 표시 */}
      {cart.length === 0 ? (
        <p className="text-gray-500">장바구니가 비어있습니다.</p>
      ) : (
        <ul className="space-y-4">
          {/* 각 상품을 반복해서 표시 */}
          {cart.map((item) => (
            <li key={item.id} className="flex justify-between items-center border-b pb-4">
              {/* 상품명 */}
              <span className="text-lg">{item.name}</span>
              <div className="flex items-center">
                {/* 수량 (읽기 전용) */}
                <span className="mx-2 w-20 text-center border rounded-lg p-2 text-lg bg-gray-50">{item.quantity}</span>
                {/* 상품 가격 (가격 × 수량) */}
                <span className="ml-4 text-lg">{item.price * item.quantity}원</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* 장바구니에 상품이 있으면 총합과 결제 버튼 표시 */}
      {cart.length > 0 && (
        <div className="flex justify-between items-center mt-6">
          {/* 총 결제금액 */}
          <p className="text-xl font-semibold">총합: {total}원</p>
          {/* 결제 버튼 (아직 연동 안 됨) */}
          <button className="btn-green" onClick={() => alert("결제 단말 연동 필요")}>결제하기</button>
        </div>
      )}
    </div>
  );
}


