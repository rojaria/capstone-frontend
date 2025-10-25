# Firebase Realtime Database 구조 가이드

## 📋 개요
이 문서는 스마트 쇼핑카트 시스템의 Firebase Realtime Database 구조를 설명합니다.
임베디드 담당자는 이 구조에 맞춰 센서 데이터를 전송해야 합니다.

## 🗂️ 데이터베이스 구조

### 1. **products** (상품 정보)
```
products/
├── {barcode}/                    # 바코드가 키
│   ├── name: "신라면"            # 상품명 (string)
│   ├── price: 3500              # 가격 (number)
│   ├── category: "식품"          # 카테고리 (string)
│   ├── stock: 50                # 재고수량 (number)
│   └── inStock: true            # 판매가능여부 (boolean)
```

**예시:**
```json
{
  "products": {
    "8801234567890": {
      "name": "신라면",
      "price": 3500,
      "category": "식품",
      "stock": 50,
      "inStock": true
    },
    "8801234567892": {
      "name": "코카콜라",
      "price": 1500,
      "category": "음료",
      "stock": 100,
      "inStock": true
    }
  }
}
```

### 2. **carts** (카트별 장바구니)
```
carts/
├── {cartNumber}/                 # 카트 번호가 키 (예: "001", "002")
│   ├── inUse: true              # 카트 사용중 여부 (boolean)
│   ├── userId: "user123"        # 현재 사용자 ID (string)
│   ├── registeredAt: 1234567890 # 등록 시간 (timestamp)
│   └── items/                   # 장바구니 아이템들
│       ├── {barcode}/           # 바코드가 키
│       │   ├── name: "신라면"    # 상품명 (string)
│       │   ├── price: 3500      # 가격 (number)
│       │   ├── quantity: 2      # 수량 (number)
│       │   ├── barcode: "8801234567890" # 바코드 (string)
│       │   └── addedAt: 1234567890 # 추가된 시간 (timestamp)
```

**예시:**
```json
{
  "carts": {
    "001": {
      "inUse": true,
      "userId": "S1BXg7OyqrVIgtLtr6CnnAt3dcB2",
      "registeredAt": 1703123456789,
      "items": {
        "8801234567890": {
          "name": "신라면",
          "price": 3500,
          "quantity": 2,
          "barcode": "8801234567890",
          "addedAt": 1703123456789
        },
        "8801234567892": {
          "name": "코카콜라",
          "price": 1500,
          "quantity": 1,
          "barcode": "8801234567892",
          "addedAt": 1703123460000
        }
      }
    }
  }
}
```

### 3. **users** (사용자 정보)
```
users/
├── {userId}/                    # Firebase Auth UID가 키
│   ├── email: "user@example.com" # 이메일 (string)
│   ├── cartNumber: "001"        # 현재 사용중인 카트 번호 (string)
│   ├── points: 150              # 현재 포인트 (number)
│   ├── totalDistance: 250       # 총 이동거리 (number)
│   ├── pointHistory/            # 포인트 사용/적립 내역
│   │   ├── {pushId}/           # 자동생성 키
│   │   │   ├── amount: 10      # 포인트 양 (number)
│   │   │   ├── type: "earned"  # 타입: "earned" | "used"
│   │   │   ├── reason: "distance" # 이유: "distance" | "payment"
│   │   │   ├── description: "50m 이동" # 설명 (string)
│   │   │   └── timestamp: 1234567890 # 시간 (timestamp)
```

**예시:**
```json
{
  "users": {
    "S1BXg7OyqrVIgtLtr6CnnAt3dcB2": {
      "email": "user@example.com",
      "cartNumber": "001",
      "points": 150,
      "totalDistance": 250,
      "pointHistory": {
        "pushId1": {
          "amount": 10,
          "type": "earned",
          "reason": "distance",
          "description": "50m 이동",
          "timestamp": 1703123456789
        }
      }
    }
  }
}
```

## 🔧 센서 데이터 전송 가이드

### 1. **상품 스캔 시 장바구니 추가**
**경로:** `carts/{cartNumber}/items/{barcode}`

**전송 데이터:**
```json
{
  "name": "상품명",
  "price": 3500,
  "quantity": 1,
  "barcode": "8801234567890",
  "addedAt": 1703123456789
}
```

**주의사항:**
- `barcode`를 키로 사용하여 중복 방지
- 이미 존재하는 바코드면 `quantity`만 증가
- `addedAt`은 현재 시간의 timestamp 사용

### 2. **카트 등록/해제**
**경로:** `carts/{cartNumber}`

**카트 등록:**
```json
{
  "inUse": true,
  "userId": "사용자UID",
  "registeredAt": 1703123456789
}
```

**카트 해제:**
```json
{
  "inUse": false,
  "userId": null,
  "registeredAt": 1703123456789
}
```

### 3. **포인트 관련 데이터**
**경로:** `users/{userId}/totalDistance` 또는 `users/{userId}/points`

**거리 업데이트:**
```json
250  // 새로운 총 거리 (number)
```

**포인트 내역 추가:**
```json
{
  "amount": 10,
  "type": "earned",
  "reason": "distance",
  "description": "50m 이동",
  "timestamp": 1703123456789
}
```

## 📡 API 엔드포인트 (선택사항)

Firebase Functions를 통해 REST API도 제공됩니다:

### 1. 상품 스캔 후 장바구니 추가
```
POST /api/cart/addScannedItem
Content-Type: application/json

{
  "userId": "사용자UID",
  "barcode": "8801234567890",
  "quantity": 1
}
```

### 2. 거리 기반 포인트 지급
```
POST /api/points/addDistancePoints
Content-Type: application/json

{
  "userId": "사용자UID",
  "distance": 50
}
```

## ⚠️ 중요 주의사항

1. **바코드 형식:** 13자리 숫자 문자열 (예: "8801234567890")
2. **카트 번호:** 3자리 문자열 (예: "001", "002")
3. **타임스탬프:** JavaScript Date.now() 또는 Unix timestamp
4. **실시간 동기화:** Firebase는 실시간으로 데이터를 동기화하므로 중복 전송 주의
5. **권한 설정:** Firebase Security Rules에서 적절한 읽기/쓰기 권한 설정 필요

## 🧪 테스트 데이터

개발/테스트용 샘플 상품 데이터:
```json
{
  "8801234567890": {"name": "신라면", "price": 3500, "category": "식품", "stock": 50, "inStock": true},
  "8801234567892": {"name": "코카콜라", "price": 1500, "category": "음료", "stock": 100, "inStock": true},
  "8801234567894": {"name": "우유", "price": 2500, "category": "유제품", "stock": 20, "inStock": true}
}
```

## 📞 문의사항

구현 중 문제가 있으면 프론트엔드 담당자에게 문의해주세요.
- GitHub: https://github.com/rojaria/capstone-frontend
- 프로젝트 구조: `/my-app` 폴더 참고
