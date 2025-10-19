// React에서 필요한 기능들 가져오기
import React from "react";
// 페이지 이동과 상태 전달 관련 기능 가져오기
import { useLocation } from "react-router-dom";

// 결제 페이지 컴포넌트
export default function CheckoutPage() {
  const location = useLocation(); // 이전 페이지에서 전달받은 데이터 가져오기
  const { cart, total } = location.state; // 장바구니와 총합 데이터

  // 결제 처리 함수
  const handlePayment = () => {
    alert("결제가 완료되었습니다!"); // 결제 완료 알림
  };

  return (
    <div className="card max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">결제 화면</h2>
      {/* 주문 상품 목록 */}
      <ul className="space-y-2 mb-4">
        {/* 각 상품을 반복해서 표시 */}
        {cart.map(item => (
          <li key={item.id} className="flex justify-between">
            <span>{item.name} x {item.quantity}</span>
            <span>{item.price * item.quantity}원</span>
          </li>
        ))}
      </ul>
      {/* 총 결제금액 */}
      <p className="text-lg font-semibold mb-4">총합: {total}원</p>
      {/* 결제 버튼 */}
      <button onClick={handlePayment} className="btn">결제하기</button>
    </div>
  );
}
