from pathlib import Path

import refresh_data


SOURCE = Path(r"C:\Users\gkswl\OneDrive\바탕 화면\호가 및 실거래가_6생활권외_V2.xlsx")
OUTPUT = Path(__file__).parent / "data" / "listings-sejong-other.json"


if __name__ == "__main__":
    refresh_data.main(
        source=SOURCE,
        output=OUTPUT,
        sheet_name="매물요약",
        broker_sheet_name="동일매물_중개사",
        real_transaction_sheet_name="타입별_실거래가",
    )
