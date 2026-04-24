export async function middleware(request) {
  // Force cache bypass for all requests
  const response = fetch(request.url, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
  return response
}

export const config = {
  matcher: ['/(.*)'],
}
