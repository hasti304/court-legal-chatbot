import qrcode
from PIL import Image

# Your chatbot URL
url = "https://hasti304.github.io/court-legal-chatbot/"

# Create QR code
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_H,  # High error correction for logo
    box_size=10,
    border=4,
)
qr.add_data(url)
qr.make(fit=True)

# Create QR code image with gradient colors
img = qr.make_image(fill_color="#1e3c72", back_color="white")
img = img.convert("RGB")

# If you have a logo file, uncomment and adjust this section:
# try:
#     logo = Image.open("path/to/your/logo.png")
#     # Calculate logo size (should be about 1/5 of QR code)
#     qr_width, qr_height = img.size
#     logo_size = qr_width // 5
#     logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
#     
#     # Calculate position to center logo
#     logo_pos = ((qr_width - logo_size) // 2, (qr_height - logo_size) // 2)
#     
#     # Paste logo onto QR code
#     img.paste(logo, logo_pos)
# except:
#     print("Logo file not found, creating QR code without logo")

# Save
img.save("frontend/public/qr-code-professional.png")
print("Professional QR code saved to frontend/public/qr-code-professional.png")
