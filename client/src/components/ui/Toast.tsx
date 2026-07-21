import { useCallback, useEffect, useState } from 'react'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

let _addToast: ((message: string, type: Toast['type']) => void) | null = null

export function toast(message: string, type: Toast['type'] = 'info') {
  _addToast?.(message, type)
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = `toast_${Date.now()}`
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  useEffect(() => {
    _addToast = addToast
    return () => {
      _addToast = null
    }
  }, [addToast])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={remove} />
      ))}
    </div>
  )
}

function ToastItem({
  toast: t,
  onRemove,
}: {
  toast: Toast
  onRemove: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(t.id), 3000)
    return () => clearTimeout(timer)
  }, [t.id, onRemove])

  const bg =
    t.type === 'success'
      ? 'bg-green-600'
      : t.type === 'error'
        ? 'bg-red-600'
        : 'bg-dark-700'

  return (
    <button
      type="button"
      className={`${bg} text-white px-4 py-2 rounded-lg shadow-lg text-sm pointer-events-auto animate-in fade-in slide-in-from-bottom-2`}
      onClick={() => onRemove(t.id)}
    >
      {t.message}
    </button>
  )
}
