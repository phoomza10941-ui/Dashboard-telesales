from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # First check login page
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    # Check home / login
    page.goto('http://localhost:3001')
    page.wait_for_load_state('networkidle')
    page.screenshot(path='D:/tmp_review/home.png', full_page=True)
    print("Home page title:", page.title())
    print("Home URL:", page.url)

    # Check /my-desk (likely redirects to login)
    page.goto('http://localhost:3001/my-desk')
    page.wait_for_load_state('networkidle')
    page.screenshot(path='D:/tmp_review/my-desk-unauth.png', full_page=True)
    print("My-Desk URL after nav:", page.url)

    # Check /supervisor
    page.goto('http://localhost:3001/supervisor')
    page.wait_for_load_state('networkidle')
    page.screenshot(path='D:/tmp_review/supervisor-unauth.png', full_page=True)
    print("Supervisor URL after nav:", page.url)

    # Check /war-room
    page.goto('http://localhost:3001/war-room')
    page.wait_for_load_state('networkidle')
    page.screenshot(path='D:/tmp_review/war-room-unauth.png', full_page=True)
    print("War-Room URL after nav:", page.url)

    browser.close()
    print("Done!")
