import requests
from time import sleep
from datetime import datetime

URL = "http://localhost:5000/health"


def check_health():
    try:
        r = requests.get(URL)
        if r.status_code == 200:
            print(f"[{datetime.now()}] ✅ {r.status_code}: {r.json()}")
        else:
            print(f"[{datetime.now()}] ⚠️ Status {r.status_code}")
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Could not connect: {e}")


if __name__ == "__main__":
    print(f"🔍 Watching {URL} ...")
    while True:
        check_health()
        sleep(2)
