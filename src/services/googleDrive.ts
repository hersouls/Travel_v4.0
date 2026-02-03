// ============================================
// Google Drive Service (Client-Side)
// ============================================

import type { BackupData } from './database'

// Configuration
const CLIENT_ID = '918814780081-cu6o0krg6d7ihmnspjbe1nsi272t695j.apps.googleusercontent.com'
const API_KEY = 'AIzaSyAxfac7PrWNus6b7xxUGM3irAk_xO-a4vY' // Public API Key for client-side use
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

// Global types
declare global {
  interface Window {
    gapi: any
    google: any
  }
}

export interface DriveFile {
  id: string
  name: string
  size?: string
  createdTime?: string
  modifiedTime?: string
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

class GoogleDriveService {
  private tokenClient: any
  private _isConnected = false
  private initialized = false

  // Dynamic Script Loading
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = src
      script.onload = () => resolve()
      script.onerror = (err) => reject(err)
      document.body.appendChild(script)
    })
  }

  // Initialize Library
  async init(): Promise<void> {
    if (this.initialized) return

    try {
      await Promise.all([
        this.loadScript('https://apis.google.com/js/api.js'),
        this.loadScript('https://accounts.google.com/gsi/client'),
      ])

      await new Promise<void>((resolve, reject) => {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              apiKey: API_KEY,
              discoveryDocs: [DISCOVERY_DOC],
            })
            resolve()
          } catch (err) {
            reject(err)
          }
        })
      })

      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp: any) => {
          if (resp.error) {
            console.error('Auth Error:', resp)
            return
          }
          this._isConnected = true
        },
      })

      // Check if we have a valid token already
      const token = window.gapi.client.getToken()
      if (token) {
        this._isConnected = true
      }

      this.initialized = true
    } catch (error) {
      console.error('Google Drive Init Error:', error)
      throw error
    }
  }

  isConnected(): boolean {
    return this._isConnected && !!window.gapi?.client?.getToken()
  }

  async connect(): Promise<void> {
    if (!this.initialized) await this.init()

    return new Promise((resolve, reject) => {
      this.tokenClient.callback = (resp: any) => {
        if (resp.error) {
          reject(resp)
        } else {
          // Critical: Set the token for gapi types to use
          if (window.gapi) {
            window.gapi.client.setToken(resp)
          }
          this._isConnected = true
          resolve()
        }
      }

      // Prompt the user to select an account
      this.tokenClient.requestAccessToken({ prompt: 'consent' })
    })
  }

  disconnect(): void {
    const token = window.gapi?.client?.getToken()
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token)
      window.gapi.client.setToken(null)
      this._isConnected = false
    }
  }

  async listBackups(): Promise<DriveFile[]> {
    if (!this.isConnected()) throw new Error('Not authenticated')

    try {
      const response = await window.gapi.client.drive.files.list({
        pageSize: 10,
        fields: 'files(id, name, size, createdTime, modifiedTime)',
        q: "name contains 'travel-backup' and trashed=false",
        orderBy: 'createdTime desc',
      })
      return response.result.files || []
    } catch (error) {
      console.error('List Backups Error:', error)
      throw error
    }
  }

  async uploadBackup(
    data: string,
    fileName: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    if (!this.isConnected()) throw new Error('Not authenticated')

    const fileContent = data // JSON string
    const file = new Blob([fileContent], { type: 'application/json' })
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
    }

    const accessToken = window.gapi.client.getToken().access_token
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', file)

    // Using fetch for upload to support progress if needed (though fetch doesn't support upload progress natively easily without streams, we'll keep it simple or use XHR for progress)
    // For reliable progress, XHR is better
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(
        'POST',
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        true
      )
      xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken)

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100),
            })
          }
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText)
          resolve(response.id)
        } else {
          reject(new Error('Upload failed: ' + xhr.statusText))
        }
      }

      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.send(form)
    })
  }

  async downloadBackup(fileId: string): Promise<string> {
    if (!this.isConnected()) throw new Error('Not authenticated')

    const response = await window.gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media',
    })

    return typeof response.body === 'string' ? response.body : JSON.stringify(response.result)
  }

  async deleteBackup(fileId: string): Promise<void> {
    if (!this.isConnected()) throw new Error('Not authenticated')

    await window.gapi.client.drive.files.delete({
      fileId: fileId,
    })
  }
}

export const googleDrive = new GoogleDriveService()

