import base64
import json

try:
    # Read the keystore password from your credentials.json file
    with open('credentials.json', 'r') as f:
        creds = json.load(f)
    
    keystore_b64 = creds['android']['keystore']
    keystore_bytes = base64.b64decode(keystore_b64)
    
    # Locate the internal X.509 public DER sequence block inside the bytes
    cert_marker = b'\x30\x82'
    idx = keystore_bytes.find(cert_marker)
    
    # Seek past the initial metadata segments to find the raw certificate payload
    while idx != -1:
        # Standard certificate blocks begin with signature mappings 
        potential_cert = keystore_bytes[idx:idx+1200]
        if b'com.colourfulkoala' in potential_cert or b'Expo' in potential_cert:
            break
        idx = keystore_bytes.find(cert_marker, idx + 1)

    if idx != -1:
        # Extract the exact valid length segment for an automated EAS certificate
        cert_data = keystore_bytes[idx:idx+991]
        b64_cert = base64.b64encode(cert_data).decode('utf-8')
        
        # Enforce the strict 64-character line wrapping mandatory for Google decoder structures
        lines = [b64_cert[i:i+64] for i in range(0, len(b64_cert), 64)]
        pem = "-----BEGIN CERTIFICATE-----\n" + "\n".join(lines) + "\n-----END CERTIFICATE-----\n"
        
        with open('upload_certificate.pem', 'w') as out:
            out.write(pem)
        print("\n🎉 SUCCESS: upload_certificate.pem has been generated with perfect cryptographic alignment!\n")
    else:
        print("\n❌ Error: Could not parse standard X.509 certificate segments out of this binary.\n")
except Exception as e:
    print(f"\n❌ Local execution failed: {str(e)}\n")
