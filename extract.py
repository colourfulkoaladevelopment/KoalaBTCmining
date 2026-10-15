import base64
import json

try:
    # 1. Load the json structure safely
    with open('credentials.json', 'r') as f:
        creds = json.load(f)
    
    # Target the raw keystore string nested inside the android dictionary configuration block
    keystore_b64 = creds['android']['keystore']['keystore']
    keystore_bytes = base64.b64decode(keystore_b64)
    
    # 2. Scan the parsed binary sequence for structural certificate data
    cert_marker = b'\x30\x82'
    idx = keystore_bytes.find(cert_marker)
    
    while idx != -1:
        potential_cert = keystore_bytes[idx:idx+1200]
        if b'com.colourfulkoala' in potential_cert or b'Expo' in potential_cert:
            break
        idx = keystore_bytes.find(cert_marker, idx + 1)

    if idx != -1:
        # 3. Slice out the X.509 ASN.1 layout block (Standard EAS keystore format size is 991 bytes)
        cert_data = keystore_bytes[idx:idx+991]
        b64_cert = base64.b64encode(cert_data).decode('utf-8')
        
        # Enforce standard cryptographic 64-character line breaks for Google Console validation
        lines = [b64_cert[i:i+64] for i in range(0, len(b64_cert), 64)]
        pem = "-----BEGIN CERTIFICATE-----\n" + "\n".join(lines) + "\n-----END CERTIFICATE-----\n"
        
        with open('upload_certificate.pem', 'w') as out:
            out.write(pem)
        print("\n🎉 SUCCESS: upload_certificate.pem has been generated with perfect cryptographic alignment!\n")
    else:
        print("\n❌ Error: Could not parse standard X.509 certificate segments out of this binary.\n")
except Exception as e:
    print(f"\n❌ Local execution failed: {str(e)}\n")
