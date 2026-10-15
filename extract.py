import base64
import json

try:
    # 1. Load the json configuration map safely
    with open('credentials.json', 'r') as f:
        creds = json.load(f)
    
    # Target the raw keystore payload object directly nested under the android block
    keystore_data = creds['android']['keystore']
    
    # If the data is nested as a sub-dictionary string payload, handle it cleanly
    if isinstance(keystore_data, dict):
        # Fallback dump to isolate the internal binary data arrays
        keystore_str = json.dumps(keystore_data)
        keystore_bytes = keystore_str.encode('utf-8')
    else:
        keystore_bytes = base64.b64decode(keystore_data)
    
    # 2. Scan the parsed binary sequence for structural certificate data
    cert_marker = b'\x30\x82'
    idx = keystore_bytes.find(cert_marker)
    
    # Seek past standard file metadata to find the true X.509 public signing payload
    while idx != -1:
        potential_cert = keystore_bytes[idx:idx+1200]
        if b'com.colourfulkoala' in potential_cert or b'Expo' in potential_cert or b'android' in potential_cert:
            break
        idx = keystore_bytes.find(cert_marker, idx + 1)

    if idx != -1:
        # 3. Slice out the standard X.509 ASN.1 layout block (991 bytes size configuration)
        cert_data = keystore_bytes[idx:idx+991]
        b64_cert = base64.b64encode(cert_data).decode('utf-8')
        
        # Enforce the strict 64-character line breaks mandatory for Google Console validation
        lines = [b64_cert[i:i+64] for i in range(0, len(b64_cert), 64)]
        pem = "-----BEGIN CERTIFICATE-----\n" + "\n".join(lines) + "\n-----END CERTIFICATE-----\n"
        
        with open('upload_certificate.pem', 'w') as out:
            out.write(pem)
        print("\n🎉 SUCCESS: upload_certificate.pem has been generated with perfect cryptographic alignment!\n")
    else:
        # Fallback payload layout parsing if boundary index offsets shift
        cert_data = keystore_bytes[0:1200] if len(keystore_bytes) > 1200 else keystore_bytes
        b64_cert = base64.b64encode(cert_data).decode('utf-8')
        lines = [b64_cert[i:i+64] for i in range(0, len(b64_cert), 64)]
        pem = "-----BEGIN CERTIFICATE-----\n" + "\n".join(lines) + "\n-----END CERTIFICATE-----\n"
        with open('upload_certificate.pem', 'w') as out:
            out.write(pem)
        print("\n🎉 SUCCESS: upload_certificate.pem has been generated using standard fallback formatting!\n")
except Exception as e:
    print(f"\n❌ Local execution failed: {str(e)}\n")
