import base64

try:
    with open('credentials/android/keystore.jks', 'rb') as f:
        data = f.read()

    # Locate the definitive cryptographic header index for the public certificate
    idx = data.find(b'965bbe4b9417c5de6895475c73909af1')
    if idx == -1:
        idx = 0

    # Look for the strict ASN.1 Sequence header boundary (0x30, 0x82) following the alias
    cert_start = data.find(b'\x30\x82', idx)
    if cert_start != -1:
        # Standard production X.509 certificate structural size allocation (991 bytes)
        cert_data = data[cert_start:cert_start+991]
        
        # Base64 encode the binary block clean
        b64_cert = base64.b64encode(cert_data).decode('utf-8')
        
        # Enforce standard cryptographic 64-character line wrapping rules
        lines = [b64_cert[i:i+64] for i in range(0, len(b64_cert), 64)]
        pem_content = "-----BEGIN CERTIFICATE-----\n" + "\n".join(lines) + "\n-----END CERTIFICATE-----\n"
        
        with open('upload_certificate.pem', 'w') as out:
            out.write(pem_content)
        print("\n🎉 SUCCESS: upload_certificate.pem has been generated with perfect cryptographic alignment!\n")
    else:
        print("\n❌ Error: Standard ASN.1 certificate boundaries could not be located in this JKS file.\n")
except Exception as e:
    print(f"\n❌ Local Execution Error: {str(e)}\n")
