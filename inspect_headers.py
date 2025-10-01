import csv

csv_path = "data/services/prioritized_services.csv"

with open(csv_path, newline='', encoding='utf-8') as csvfile:
    reader = csv.reader(csvfile)
    headers = next(reader)
    print("🔍 CSV Headers:", headers)
