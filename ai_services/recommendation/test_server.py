#!/usr/bin/env python3
"""Quick test to verify the server is responding."""
import urllib.request
import json

def test_endpoint(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Test'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            print(f"✓ {url}")
            print(f"  Status: {resp.status}")
            print(f"  Response: {json.dumps(data, indent=2)}")
            return True
    except Exception as e:
        print(f"✗ {url}")
        print(f"  Error: {e}")
        return False

if __name__ == "__main__":
    print("Testing recommendation service at http://127.0.0.1:5000\n")
    
    tests = [
        "http://127.0.0.1:5000/",
        "http://127.0.0.1:5000/docs",
    ]
    
    results = [test_endpoint(url) for url in tests]
    
    if all(results):
        print("\n✓ All tests passed!")
    else:
        print("\n✗ Some tests failed")
        exit(1)