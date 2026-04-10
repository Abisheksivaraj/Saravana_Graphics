# Saravana Graphics - Label & Card Designer

A professional MERN-based label and card design application inspired by **Bartender**'s precision and **CorelDraw**'s design freedom.

## ✨ Features

- **Drag & Drop Editor**: Smooth, high-performance canvas using `Konva.js`.
- **Professional Tools**: Add Text, Shapes, Barcodes (CODE128, EAN, etc.), and QR Codes.
- **Size Presets**: Industry-standard sizes for Price Tags, Clothing Tags, Business Cards, and Shipping Labels.
- **Custom Sizes**: Support for any dimension in pixels (with auto-translation to printable sizes).
- **Print & Export**: One-click high-resolution PNG export or direct-to-printer preview.
- **Cloud Storage**: Save your designs and access them from anywhere.
- **Template Library**: Pre-built professional layouts to get you started faster.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [MongoDB](https://www.mongodb.com/) (running locally or a cloud URI)

### Setup

1. **Backend**:
   - Open a terminal in `backend/` folder.
   - Install dependencies: `npm install`.
   - Update `MONGODB_URI` and `JWT_SECRET` in `.env` file if needed.
   - Start the server: `npm run dev`.

2. **Frontend**:
   - Open another terminal in `frontend/` folder.
   - Install dependencies: `npm install`.
   - Start the dev server: `npm run dev`.

3. **Open the App**:
   - Navigate to `http://localhost:5173`.

## 🛠 Tech Stack

- **Frontend**: React, Vite, Zustand, Konva, Lucide-React.
- **Backend**: Node.js, Express, MongoDB, Mongoose.
- **Auth**: JWT based token authentication.
- **Barcodes**: JsBarcode & qrcode.js.

---

Designed with ❤️ for Saravana Graphics.
