# 호가 브리핑

엑셀 `세대별정리_row` 탭을 고객 상담용 화면으로 보여주는 로컬 웹앱입니다.

## 실행

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:5173/`을 엽니다.

## 데이터 갱신

원본 엑셀 파일을 수정한 뒤 아래를 실행하면 `data/listings.json`이 다시 만들어집니다.

```powershell
python refresh_data.py
```

## 배포용 파일 만들기

주간 자료를 갱신한 뒤 외부 웹에 올릴 때는 아래 파일을 실행합니다.

```powershell
배포파일_만들기.bat
```

그러면 `dist` 폴더가 새로 만들어집니다. 이 `dist` 폴더 안의 파일들을 Netlify 같은 정적 웹 호스팅에 업로드하면 됩니다.
