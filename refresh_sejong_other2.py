from pathlib import Path

import refresh_data


SOURCE = Path(r"C:\Users\gkswl\OneDrive\바탕 화면\호가 및 실거래가_6생활권외2_V2.xlsx")
OUTPUT = Path(__file__).parent / "data" / "listings-sejong-other2.json"


def main():
    if not SOURCE.is_file():
        print(f"6생활권외2 원본 파일 없음, 기존 자료 유지: {SOURCE}")
        return
    refresh_data.main(
        source=SOURCE,
        output=OUTPUT,
        sheet_name="매물요약",
        broker_sheet_name="동일매물_중개사",
        real_transaction_sheet_name="타입별_실거래가",
    )


if __name__ == "__main__":
    main()
