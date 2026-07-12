import React, { useEffect } from 'react'
import { useUpdateStore } from '../../stores/updateStore'
import Modal from '../ui/Modal'

export default function UpdateNotification() {
  const {
    updateAvailable,
    updateInfo,
    downloading,
    downloadProgress,
    error,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  } = useUpdateStore()

  const [showModal, setShowModal] = React.useState(false)

  useEffect(() => {
    checkForUpdates()
  }, [checkForUpdates])

  useEffect(() => {
    if (updateAvailable) {
      setShowModal(true)
    }
  }, [updateAvailable])

  if (!showModal) return null

  return (
    <Modal open={showModal} onClose={() => !downloading && setShowModal(false)}>
      <div className="p-6">
        <h2 className="text-xl font-bold text-white mb-4">Update Available</h2>

        <div className="mb-6">
          <p className="text-primary-400 text-lg mb-2">
            Version {updateInfo?.version}
          </p>
          {updateInfo?.notes && (
            <p className="text-dark-400 text-sm">{updateInfo.notes}</p>
          )}

          {downloading && (
            <div className="mt-4">
              <div className="w-full bg-dark-700 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-dark-400 text-xs mt-2 text-center">
                {downloadProgress}%
              </p>
            </div>
          )}

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        <div className="flex gap-3 justify-end">
          {!downloading ? (
            <>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-dark-400 hover:text-white"
              >
                Later
              </button>
              <button
                type="button"
                onClick={downloadUpdate}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
              >
                Update
              </button>
            </>
          ) : downloadProgress === 100 ? (
            <button
              type="button"
              onClick={installUpdate}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
            >
              Restart & Install
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
