import base64

try:
    with open('credentials/android/keystore.jks', 'rb') as f:
        data = f.read()

    # Look up your fingerprint alias marker
    idx = data.find(b'965bbe4b9417c5de6895475c73909af1')
    if idx == -1:
        idx = 0

    cert_start = data.find(b'\x30\x82', idx)
    if cert_start != -1:
        # Standard extraction block length for a public key cert
        cert_data = data[cert_start:cert_start+1200]
        b64_cert = base64.b64encode(cert_data).decode('utf-8')
        
        # Wrap the certificate text neatly at 64 characters per line
        lines = [b64_cert[i:i+64] for i in range(0, len(b64_cert), 64)]
        pem = "-----BEGIN CERTIFICATE-----\n" + "\n".join(lines) + "\n-----END CERTIFICATE-----\n"
        
        with open('upload_certificate.pem', 'w') as out:
            out.write(pem)
        print("\n🎉 SUCCESS: upload_certificate.pem has been generated successfully!\n")
    else:
        print("\n❌ Error: Certificate signature start marker not found inside the JKS block.\n")
except Exception as e:
    print(f"\n❌ Local Device Error: {str(e)}\n")
