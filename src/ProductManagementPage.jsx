import React, { useState, useEffect } from "react";
import { ref, onValue, set, remove, get } from "firebase/database";
import { database } from "./firebase";

// 상품 관리 페이지 (관리자용)
export default function ProductManagementPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // 폼 상태
  const [formData, setFormData] = useState({
    barcode: "",
    name: "",
    price: "",
    category: "식품",
    stock: 100,  // 재고 개수 추가
    inStock: true
  });

  const [editingId, setEditingId] = useState(null);

  // 상품 목록 실시간 조회
  useEffect(() => {
    const productsRef = ref(database, "products");
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const productArray = Object.keys(data).map(key => ({
          barcode: key,
          ...data[key]
        }));
        setProducts(productArray);
      } else {
        setProducts([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 폼 입력 처리
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value
    });
  };

  // 상품 추가/수정
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.barcode || !formData.name || !formData.price) {
      alert("바코드, 상품명, 가격을 모두 입력해주세요.");
      return;
    }

    try {
      const productRef = ref(database, `products/${formData.barcode}`);
      const stockNum = parseInt(formData.stock) || 0;
      await set(productRef, {
        name: formData.name,
        price: parseInt(formData.price),
        category: formData.category,
        stock: stockNum,
        inStock: stockNum > 0,  // 재고 0이면 자동 품절
        updatedAt: Date.now()
      });

      alert(editingId ? "상품이 수정되었습니다!" : "상품이 추가되었습니다!");
      
      // 폼 초기화
      setFormData({
        barcode: "",
        name: "",
        price: "",
        category: "식품",
        stock: 100,
        inStock: true
      });
      setEditingId(null);
      setShowAddForm(false);

    } catch (error) {
      console.error("상품 저장 오류:", error);
      alert("상품 저장 중 오류가 발생했습니다: " + error.message);
    }
  };

  // 상품 수정 모드
  const handleEdit = (product) => {
    setFormData({
      barcode: product.barcode,
      name: product.name,
      price: product.price.toString(),
      category: product.category,
      stock: product.stock || 0,
      inStock: product.inStock
    });
    setEditingId(product.barcode);
    setShowAddForm(true);
  };

  // 상품 삭제
  const handleDelete = async (barcode) => {
    if (!confirm("정말 이 상품을 삭제하시겠습니까?")) return;

    try {
      const productRef = ref(database, `products/${barcode}`);
      await remove(productRef);
      alert("상품이 삭제되었습니다.");
    } catch (error) {
      console.error("상품 삭제 오류:", error);
      alert("상품 삭제 중 오류가 발생했습니다: " + error.message);
    }
  };

  // 재고 상태 토글
  const toggleStock = async (barcode, currentStock) => {
    try {
      const productRef = ref(database, `products/${barcode}/inStock`);
      await set(productRef, !currentStock);
    } catch (error) {
      console.error("재고 상태 변경 오류:", error);
      alert("재고 상태 변경 중 오류가 발생했습니다.");
    }
  };

  // 샘플 데이터 추가
  const addSampleProducts = async () => {
    // 💡 장바구니 테스트 데이터와 겹치는 상품: 신라면, 코카콜라, 우유, 과자, 사과
    const samples = [
      { barcode: "8801234567890", name: "신라면", price: 3500, category: "식품", stock: 50, inStock: true },    // ⭐ 장바구니 테스트 데이터
      { barcode: "8801234567891", name: "삼양라면", price: 3000, category: "식품", stock: 30, inStock: true },
      { barcode: "8801234567892", name: "코카콜라", price: 1500, category: "음료", stock: 100, inStock: true },  // ⭐ 장바구니 테스트 데이터
      { barcode: "8801234567893", name: "사이다", price: 1500, category: "음료", stock: 80, inStock: true },
      { barcode: "8801234567894", name: "우유", price: 2500, category: "유제품", stock: 20, inStock: true },    // ⭐ 장바구니 테스트 데이터
      { barcode: "8801234567895", name: "요구르트", price: 3000, category: "유제품", stock: 40, inStock: true },
      { barcode: "8801234567896", name: "식빵", price: 2000, category: "베이커리", stock: 15, inStock: true },
      { barcode: "8801234567897", name: "과자", price: 1800, category: "식품", stock: 60, inStock: true },      // ⭐ 장바구니 테스트 데이터
      { barcode: "8801234567898", name: "초콜릿", price: 2200, category: "식품", stock: 45, inStock: true },
      { barcode: "8801234567899", name: "사과", price: 5000, category: "과일", stock: 25, inStock: true }       // ⭐ 장바구니 테스트 데이터
    ];

    try {
      for (const product of samples) {
        const productRef = ref(database, `products/${product.barcode}`);
        await set(productRef, {
          name: product.name,
          price: product.price,
          category: product.category,
          stock: product.stock,
          inStock: product.inStock,
          updatedAt: Date.now()
        });
      }
      alert("✅ 샘플 상품 10개가 추가되었습니다!\n재고 개수도 포함되어 있습니다.");
    } catch (error) {
      console.error("샘플 데이터 추가 오류:", error);
      alert("샘플 데이터 추가 중 오류가 발생했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mt-10 text-center">
        <p className="text-black">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">상품 관리</h2>
        <div className="flex gap-2">
          {/* 샘플 데이터 추가 버튼 (테스트용) - 주석처리됨 */}
          {/* 
          <button
            onClick={addSampleProducts}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-black"
          >
            샘플 데이터 추가
          </button>
          */}
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingId(null);
              setFormData({
                barcode: "",
                name: "",
                price: "",
                category: "식품",
                inStock: true
              });
            }}
            className="px-6 py-2 bg-black text-white font-semibold rounded-lg hover:bg-black"
          >
            {showAddForm ? "취소" : "+ 상품 추가"}
          </button>
        </div>
      </div>

      {/* 상품 추가/수정 폼 */}
      {showAddForm && (
        <div className="bg-white rounded-lg p-6 shadow-md border-2 border-black">
          <h3 className="text-xl font-bold mb-4">
            {editingId ? "상품 수정" : "새 상품 추가"}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">바코드</label>
              <input
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={handleInputChange}
                disabled={editingId !== null}
                className="w-full px-3 py-2 border border-black rounded-lg disabled:bg-black"
                placeholder="8801234567890"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">상품명</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="신라면"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">가격 (원)</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="3500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">카테고리</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="식품">식품</option>
                <option value="음료">음료</option>
                <option value="유제품">유제품</option>
                <option value="베이커리">베이커리</option>
                <option value="과일">과일</option>
                <option value="채소">채소</option>
                <option value="생활용품">생활용품</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">재고 개수</label>
              <input
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleInputChange}
                min="0"
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="100"
              />
              <p className="text-xs text-black mt-1">0이면 자동 품절 처리</p>
            </div>

            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="inStock"
                  checked={formData.inStock}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                <span className="text-sm font-medium">재고 있음 (수동)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingId(null);
                }}
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-black"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-black"
              >
                {editingId ? "수정" : "추가"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 상품 목록 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-black border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white">바코드</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white">상품명</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white">가격</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white">카테고리</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-white">재고 개수</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-white">상태</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-white">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                  등록된 상품이 없습니다.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.barcode} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono">{product.barcode}</td>
                  <td className="px-6 py-4 font-medium">{product.name}</td>
                  <td className="px-6 py-4">{product.price.toLocaleString()}원</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-lg font-bold ${
                      (product.stock || 0) === 0 
                        ? "text-red-600" 
                        : (product.stock || 0) < 10 
                        ? "text-yellow-600" 
                        : "text-green-600"
                    }`}>
                      {product.stock || 0}개
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggleStock(product.barcode, product.inStock)}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        product.inStock
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {product.inStock ? "✓ 재고있음" : "✗ 품절"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(product.barcode)}
                        className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">총 상품 수</p>
          <p className="text-3xl font-bold text-blue-600">{products.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">재고 있음</p>
          <p className="text-3xl font-bold text-green-600">
            {products.filter(p => p.inStock).length}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">품절</p>
          <p className="text-3xl font-bold text-red-600">
            {products.filter(p => !p.inStock).length}
          </p>
        </div>
      </div>
    </div>
  );
}

