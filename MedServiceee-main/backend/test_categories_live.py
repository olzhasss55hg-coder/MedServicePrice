import urllib.request
import urllib.parse
import json

categories = ['Анализы', 'Прием врача', 'УЗИ', 'МРТ', 'Рентген', 'ОАК']
print('=== CATEGORY LIVE TEST (ASTANA) ===')
for cat in categories:
    q_enc = urllib.parse.quote(cat)
    city_enc = urllib.parse.quote('Астана')
    url = f'http://127.0.0.1:8000/api/search?q={q_enc}&city={city_enc}'
    req = urllib.request.urlopen(url)
    data = json.loads(req.read().decode('utf-8'))
    print(f'Category [{cat:15}]: {len(data):2} services found.')
    if data:
        svc_name = data[0]["service"]["name_raw"][:40]
        cl_name = data[0]["best_offer_clinic"]["name"][:25]
        price = data[0]["best_offer_price"]
        print(f'   -> Sample: {svc_name} | Best: {cl_name} ({price} KZT)')
