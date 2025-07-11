import { NextRequest, NextResponse } from "next/server";
import { signIn } from "next-auth/react";

export async function GET(request: NextRequest) {
  // This is a simple success page that will trigger client-side signin
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Login Successful</title>
    <script src="https://cdn.jsdelivr.net/npm/next-auth@beta/client"></script>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            background: #000; 
            color: #fff; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0; 
        }
        .container { text-align: center; }
        .spinner { 
            border: 3px solid #333; 
            border-top: 3px solid #1db954; 
            border-radius: 50%; 
            width: 40px; 
            height: 40px; 
            animation: spin 1s linear infinite; 
            margin: 20px auto; 
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <h1>Login Successful!</h1>
        <div class="spinner"></div>
        <p>Redirecting to dashboard...</p>
    </div>
    <script>
        // Redirect to dashboard after a short delay
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 2000);
    </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}