import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Mic, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const DeviceCheckModal: React.FC<Props> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [microphoneId, setMicrophoneId] = useState('');
  const [checkingDevice, setCheckingDevice] = useState<'camera' | 'microphone' | null>(null);
  const [cameraTested, setCameraTested] = useState(false);
  const [microphoneTested, setMicrophoneTested] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && cameraTested) videoRef.current.srcObject = streamRef.current;
  }, [cameraTested]);

  const checkDevice = async (kind: 'camera' | 'microphone') => {
    setCheckingDevice(kind);
    setError('');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser ini tidak mendukung akses kamera dan mikrofon.');
      }

      const deviceStream = await navigator.mediaDevices.getUserMedia({
        video: kind === 'camera' ? (cameraId ? { deviceId: { exact: cameraId } } : true) : false,
        audio: kind === 'microphone' ? (microphoneId ? { deviceId: { exact: microphoneId } } : true) : false,
      });
      if (!mountedRef.current) {
        deviceStream.getTracks().forEach((track) => track.stop());
        return;
      }

      const stream = streamRef.current || new MediaStream();
      const trackKind = kind === 'camera' ? 'video' : 'audio';
      stream.getTracks().filter((track) => track.kind === trackKind).forEach((track) => {
        track.stop();
        stream.removeTrack(track);
      });
      deviceStream.getTracks().forEach((track) => stream.addTrack(track));
      streamRef.current = stream;

      const availableDevices = await navigator.mediaDevices.enumerateDevices();
      if (!mountedRef.current) return;
      setDevices(availableDevices);
      setCameraId((current) => current || availableDevices.find((device) => device.kind === 'videoinput')?.deviceId || '');
      setMicrophoneId((current) => current || availableDevices.find((device) => device.kind === 'audioinput')?.deviceId || '');
      if (kind === 'camera') setCameraTested(true);
      else setMicrophoneTested(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (deviceError) {
      if (!mountedRef.current) return;
      const errorName = deviceError instanceof DOMException ? deviceError.name : '';
      setError(errorName === 'NotAllowedError'
        ? 'Izin ditolak. Ubah izin perangkat di pengaturan browser lalu coba lagi.'
        : errorName === 'NotFoundError'
          ? 'Perangkat yang dipilih tidak ditemukan.'
          : deviceError instanceof Error ? deviceError.message : 'Perangkat tidak dapat diakses.');
    } finally {
      if (mountedRef.current) setCheckingDevice(null);
    }
  };

  const cameras = devices.filter((device) => device.kind === 'videoinput');
  const microphones = devices.filter((device) => device.kind === 'audioinput');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1E1C]/65 p-4" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="device-check-title" className="w-full max-w-xl space-y-4 rounded-lg border border-[#D2E4E8] bg-white p-5 text-[#0F1E1C] shadow-2xl sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id="device-check-title" className="font-display text-lg font-semibold">Cek kamera & mikrofon</h2>
            <p className="mt-1 text-sm text-[#4A7A79]">Opsional. Izin hanya diminta untuk perangkat yang Anda uji.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup pemeriksaan perangkat" className="rounded-md p-2 text-[#3A6B6A] hover:bg-[#EDF5F7]">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="aspect-video overflow-hidden rounded-md bg-[#0F1E1C]">
          {cameraTested ? (
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center gap-3 text-sm text-white/80">
              <Camera className="h-5 w-5 text-[#32BFDB]" />
              Kamera belum diuji
            </div>
          )}
        </div>

        {(cameraTested || microphoneTested) && (
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <div className="rounded-md bg-[#EDF5F7] px-3 py-2 text-[#3A6B6A]">Kamera: {cameraTested ? 'izin aktif' : 'belum diuji'}</div>
            <div className="rounded-md bg-[#EDF5F7] px-3 py-2 text-[#3A6B6A]">Mikrofon: {microphoneTested ? 'izin aktif' : 'belum diuji'}</div>
          </div>
        )}

        {cameraTested && (
          <label className="block space-y-1 text-xs font-semibold text-[#3A6B6A]">
            <span className="flex items-center gap-1.5"><Camera className="h-3.5 w-3.5" /> Kamera</span>
            <select value={cameraId} onChange={(event) => setCameraId(event.target.value)} className="w-full rounded-md border border-[#D2E4E8] bg-white px-3 py-2 text-sm text-[#0F1E1C]">
              {cameras.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Kamera ${index + 1}`}</option>)}
            </select>
          </label>
        )}

        {microphoneTested && (
          <label className="block space-y-1 text-xs font-semibold text-[#3A6B6A]">
            <span className="flex items-center gap-1.5"><Mic className="h-3.5 w-3.5" /> Mikrofon</span>
            <select value={microphoneId} onChange={(event) => setMicrophoneId(event.target.value)} className="w-full rounded-md border border-[#D2E4E8] bg-white px-3 py-2 text-sm text-[#0F1E1C]">
              {microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Mikrofon ${index + 1}`}</option>)}
            </select>
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => checkDevice('camera')} disabled={checkingDevice !== null} className="inline-flex items-center justify-center gap-2 rounded-md border border-[#32BFDB] bg-[#E7F8FC] px-3 py-2.5 text-sm font-bold text-[#0F1E1C] disabled:opacity-60">
            <Camera className="h-4 w-4" /> {checkingDevice === 'camera' ? 'Memeriksa…' : 'Uji kamera'}
          </button>
          <button type="button" onClick={() => checkDevice('microphone')} disabled={checkingDevice !== null} className="inline-flex items-center justify-center gap-2 rounded-md border border-[#00785D] bg-[#E6F5F1] px-3 py-2.5 text-sm font-bold text-[#0F1E1C] disabled:opacity-60">
            <Mic className="h-4 w-4" /> {checkingDevice === 'microphone' ? 'Memeriksa…' : 'Uji mikrofon'}
          </button>
        </div>

        {error && <p role="alert" className="rounded-md bg-[#FFF8E6] px-3 py-2 text-sm text-[#5A3C00]">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={onClose} className="rounded-md border border-[#D2E4E8] px-4 py-2.5 text-sm font-semibold text-[#3A6B6A] hover:bg-[#EDF5F7]">Tutup</button>
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#00785D] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#00664F]">
            <CheckCircle2 className="h-4 w-4" />
            Selesai
          </button>
        </div>
      </section>
    </div>
  );
};