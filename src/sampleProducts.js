/**
 * 🛒 샘플 상품 데이터
 * 
 * 이 파일은 개발/테스트용 샘플 상품 정보를 담고 있습니다.
 * 상품 관리 페이지와 장바구니 테스트 데이터에서 공통으로 사용됩니다.
 */

// 전체 샘플 상품 목록 (상품 관리 페이지에서 생성)
export const SAMPLE_PRODUCTS = [
  { barcode: "8801234567890", name: "신라면", price: 3500, category: "식품", stock: 50, inStock: true },
  { barcode: "8801234567891", name: "삼양라면", price: 3000, category: "식품", stock: 30, inStock: true },
  { barcode: "8801234567892", name: "코카콜라", price: 1500, category: "음료", stock: 100, inStock: true },
  { barcode: "8801234567893", name: "사이다", price: 1500, category: "음료", stock: 80, inStock: true },
  { barcode: "8801234567894", name: "우유", price: 2500, category: "유제품", stock: 20, inStock: true },
  { barcode: "8801234567895", name: "요구르트", price: 3000, category: "유제품", stock: 40, inStock: true },
  { barcode: "8801234567896", name: "식빵", price: 2000, category: "베이커리", stock: 15, inStock: true },
  { barcode: "8801234567897", name: "과자", price: 1800, category: "식품", stock: 60, inStock: true },
  { barcode: "8801234567898", name: "초콜릿", price: 2200, category: "식품", stock: 45, inStock: true },
  { barcode: "8801234567899", name: "사과", price: 5000, category: "과일", stock: 25, inStock: true }
];

// 장바구니 테스트용 상품 (위 목록의 일부)
export const CART_TEST_PRODUCTS = [
  { barcode: "8801234567890", name: "신라면", price: 3500 },
  { barcode: "8801234567892", name: "코카콜라", price: 1500 },
  { barcode: "8801234567894", name: "우유", price: 2500 },
  { barcode: "8801234567897", name: "과자", price: 1800 },
  { barcode: "8801234567899", name: "사과", price: 5000 }
];

// 카테고리별 상품 조회
export const getProductsByCategory = (category) => {
  return SAMPLE_PRODUCTS.filter(product => product.category === category);
};

// 바코드로 상품 조회
export const getProductByBarcode = (barcode) => {
  return SAMPLE_PRODUCTS.find(product => product.barcode === barcode);
};

// 가격대별 상품 조회
export const getProductsByPriceRange = (minPrice, maxPrice) => {
  return SAMPLE_PRODUCTS.filter(
    product => product.price >= minPrice && product.price <= maxPrice
  );
};

/**
 * 상품 데이터 사용 예시:
 * 
 * import { SAMPLE_PRODUCTS, CART_TEST_PRODUCTS } from './sampleProducts';
 * 
 * // 상품 관리 페이지
 * const addSampleProducts = async () => {
 *   for (const product of SAMPLE_PRODUCTS) {
 *     await addProductToDatabase(product);
 *   }
 * };
 * 
 * // 장바구니 테스트
 * const addTestCart = async () => {
 *   for (const product of CART_TEST_PRODUCTS) {
 *     await addToCart({ ...product, quantity: 1 });
 *   }
 * };
 */

export default SAMPLE_PRODUCTS;

