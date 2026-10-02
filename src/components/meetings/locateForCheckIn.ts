export function locate(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Trình duyệt không hỗ trợ vị trí. Hãy mở liên kết bằng Chrome hoặc Safari.")); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      e => reject(new Error(e.code === 1 ? "Bạn chưa cho phép truy cập vị trí. Hãy bật quyền vị trí trong trình duyệt rồi thử lại." : "Chưa lấy được GPS. Hãy đến nơi thoáng hơn và thử lại.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}
