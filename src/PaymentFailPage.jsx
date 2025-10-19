import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

// 결제 실패 페이지
export default function PaymentFailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const code = searchParams.get("code");
  const message = searchParams.get("message");
  const cartNumber = searchParams.get("cartNumber");

  return (
    <div className="w-full flex items-center justify-center p-4 py-20 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          {/* 실패 아이콘 */}
          <div className="mb-6">
            <div className="w-20 h-20 bg-red-500 rounded-full mx-auto flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-800 mb-2">결제 실패</h2>
          <p className="text-gray-600 mb-6">
            결제 처리 중 문제가 발생했습니다
          </p>

          {/* 오류 정보 */}
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-red-800 mb-2">
              <strong>오류 코드:</strong> {code || "UNKNOWN"}
            </p>
            <p className="text-sm text-red-800">
              <strong>오류 메시지:</strong> {message || "알 수 없는 오류가 발생했습니다."}
            </p>
          </div>

          {/* 안내 메시지 */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 text-left">
            <p className="text-sm text-yellow-800">
              💡 다음 사항을 확인해주세요:<br/>
              • 카드 정보가 정확한지 확인<br/>
              • 결제 한도를 초과하지 않았는지 확인<br/>
              • 인터넷 연결 상태 확인
            </p>
          </div>

          {/* 안내 메시지 */}
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6 text-left">
            <p className="text-sm text-green-800">
              ✅ <strong>장바구니 내용이 보존되었습니다</strong><br/>
              결제 실패 후에도 담은 상품들이 그대로 유지됩니다
            </p>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
            >
              장바구니로
            </button>
            <button
              onClick={() => navigate("/checkout")}
              className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

