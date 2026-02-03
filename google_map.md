"""
Google Maps URL 정보 추출기
- 단축 URL 리다이렉트 추적
- 좌표, Place ID, 장소명 추출
- JSON 파일로 저장
"""

import requests
import re
import json
from urllib.parse import urlparse, parse_qs, unquote
from datetime import datetime


def extract_maps_info(short_url: str) -> dict:
    """Google Maps 단축 URL에서 모든 정보 추출"""
    
    result = {
        "source_url": short_url,
        "extracted_at": datetime.now().isoformat(),
        "redirect_url": None,
        "place_name": None,
        "address": None,
        "coordinates": {
            "latitude": None,
            "longitude": None
        },
        "place_id": None,
        "cid": None,
        "raw_params": {}
    }
    
    try:
        # 1. 리다이렉트 추적
        response = requests.get(short_url, allow_redirects=True, timeout=10)
        final_url = response.url
        result["redirect_url"] = final_url
        
        # 2. URL 파싱
        parsed = urlparse(final_url)
        
        # 3. 좌표 추출 패턴들
        # 패턴 1: @lat,lng,zoom
        coord_match = re.search(r'@(-?\d+\.?\d*),(-?\d+\.?\d*)', final_url)
        if coord_match:
            result["coordinates"]["latitude"] = float(coord_match.group(1))
            result["coordinates"]["longitude"] = float(coord_match.group(2))
        
        # 패턴 2: !3d{lat}!4d{lng}
        lat_match = re.search(r'!3d(-?\d+\.?\d*)', final_url)
        lng_match = re.search(r'!4d(-?\d+\.?\d*)', final_url)
        if lat_match and lng_match:
            result["coordinates"]["latitude"] = float(lat_match.group(1))
            result["coordinates"]["longitude"] = float(lng_match.group(1))
        
        # 4. Place ID 추출
        place_id_match = re.search(r'place/[^/]+/([A-Za-z0-9_-]+)', final_url)
        if place_id_match:
            result["place_id"] = place_id_match.group(1)
        
        # 패턴: !1s로 시작하는 Place ID
        place_id_match2 = re.search(r'!1s(0x[a-f0-9]+:[a-f0-9x]+|ChIJ[A-Za-z0-9_-]+)', final_url)
        if place_id_match2:
            result["place_id"] = place_id_match2.group(1)
        
        # 5. CID 추출
        cid_match = re.search(r'cid=(\d+)', final_url)
        if cid_match:
            result["cid"] = cid_match.group(1)
        
        # 6. 장소명 추출
        # 패턴: /place/장소명/
        place_match = re.search(r'/place/([^/@]+)', final_url)
        if place_match:
            place_name = unquote(place_match.group(1))
            place_name = place_name.replace('+', ' ')
            result["place_name"] = place_name
        
        # 7. 쿼리 파라미터 추출
        if parsed.query:
            result["raw_params"] = parse_qs(parsed.query)
        
        # 8. data 파라미터에서 추가 정보 추출
        data_match = re.search(r'data=([^&]+)', final_url)
        if data_match:
            result["raw_params"]["data"] = unquote(data_match.group(1))
        
        # 9. 페이지 HTML에서 추가 정보 추출 시도
        if response.text:
            # 주소 추출 시도
            addr_match = re.search(r'"address":"([^"]+)"', response.text)
            if addr_match:
                result["address"] = addr_match.group(1)
            
            # 평점 추출
            rating_match = re.search(r'"rating":(\d+\.?\d*)', response.text)
            if rating_match:
                result["rating"] = float(rating_match.group(1))
            
            # 리뷰 수 추출
            review_match = re.search(r'"userRatingCount":(\d+)', response.text)
            if review_match:
                result["review_count"] = int(review_match.group(1))
            
            # 전화번호 추출
            phone_match = re.search(r'"phoneNumber":"([^"]+)"', response.text)
            if phone_match:
                result["phone"] = phone_match.group(1)
            
            # 웹사이트 추출
            website_match = re.search(r'"website":"([^"]+)"', response.text)
            if website_match:
                result["website"] = website_match.group(1)
            
            # 영업시간 추출
            hours_match = re.search(r'"openingHours":\s*(\[[^\]]+\])', response.text)
            if hours_match:
                try:
                    result["opening_hours"] = json.loads(hours_match.group(1))
                except:
                    pass
            
            # 카테고리 추출
            category_match = re.search(r'"primaryTypeDisplayName":\{"text":"([^"]+)"', response.text)
            if category_match:
                result["category"] = category_match.group(1)
        
    except requests.RequestException as e:
        result["error"] = str(e)
    
    return result


def save_to_json(data: dict, filename: str = "place_info.json"):
    """결과를 JSON 파일로 저장"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"저장 완료: {filename}")
    return filename


def main():
    # 대상 URL
    url = "https://maps.app.goo.gl/LNNNbPwSkoJqRoVo9"
    
    print("=" * 50)
    print("Google Maps URL 정보 추출기")
    print("=" * 50)
    print(f"\n입력 URL: {url}\n")
    
    # 정보 추출
    info = extract_maps_info(url)
    
    # 결과 출력
    print("추출된 정보:")
    print("-" * 50)
    print(json.dumps(info, ensure_ascii=False, indent=2))
    
    # JSON 파일 저장
    output_file = save_to_json(info)
    
    return info


if __name__ == "__main__":
    main()