// ============================================
// Google Drive Service (Client-Side)
// ============================================

import type { BackupData } from './database'

// Configuration from environment variables
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

// Token storage key
const TOKEN_STORAGE_KEY = 'google-drive-tokens'

// Validate environment variables
if (!CLIENT_ID || !API_KEY) {
  console.warn('Google Drive: Missing environment variables (VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_API_KEY)')
}

// Global types
declare global {
  interface Window {
    gapi: any
    google: any
  }
}

// ============================================
// Error Types
// ============================================

export enum DriveErrorCode {
  NOT_AUTHENTICATED = 'NOT_AUTHENTICATED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_FILE = 'INVALID_FILE',
  CONFIG_MISSING = 'CONFIG_MISSING',
  AUTH_IN_PROGRESS = 'AUTH_IN_PROGRESS',
  AUTH_CANCELLED = 'AUTH_CANCELLED',
  UNKNOWN = 'UNKNOWN',
}

export class DriveError extends Error {
  constructor(
    public code: DriveErrorCode,
    message: string,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'DriveError'
  }
}

function mapApiError(error: any): DriveError {
  const status = error?.status || error?.code || error?.result?.error?.code
  const message = error?.message || error?.result?.error?.message || 'Unknown error'

  switch (status) {
    case 401:
      return new DriveError(DriveErrorCode.TOKEN_EXPIRED, '세션이 만료되었습니다', true)
    case 403:
      return new DriveError(DriveErrorCode.PERMISSION_DENIED, '권한이 없습니다', false)
    case 404:
      return new DriveError(DriveErrorCode.FILE_NOT_FOUND, '파일을 찾을 수 없습니다', false)
    case 429:
      return new DriveError(DriveErrorCode.QUOTA_EXCEEDED, '요청 한도를 초과했습니다', true)
    default:
      if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
        return new DriveError(DriveErrorCode.NETWORK_ERROR, '네트워크 오류가 발생했습니다', true)
      }
      return new DriveError(DriveErrorCode.UNKNOWN, message, false)
  }
}

// ============================================
// Interfaces
// ============================================

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

interface StoredTokens {
  access_token: string
  refresh_token?: string
  expires_at: number
  scope?: string
  token_type?: string
}

// ============================================
// GoogleDriveService Class
// ============================================

class GoogleDriveService {
  private tokenClient: any
  private _isConnected = false
  private initialized = false
  private tokens: StoredTokens | null = null

  // Pending Promise 패턴을 위한 필드
  private pendingAuthPromise: {
    resolve: () => void
    reject: (error: DriveError) => void
  } | null = null

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

  // Token Management
  private loadStoredTokens(): StoredTokens | null {
    try {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load stored tokens:', e)
    }
    return null
  }

  private saveTokens(tokens: StoredTokens): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
      this.tokens = tokens
    } catch (e) {
      console.error('Failed to save tokens:', e)
    }
  }

  private clearTokens(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    this.tokens = null
  }

  private isTokenExpired(): boolean {
    if (!this.tokens?.expires_at) return true
    // 5분 버퍼
    return Date.now() > this.tokens.expires_at - 5 * 60 * 1000
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.tokens?.refresh_token) {
      return false
    }

    try {
      const response = await fetch('/api/drive/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.tokens.refresh_token }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Token refresh failed:', errorText)
        return false
      }

      const data = await response.json()

      // Update stored tokens
      this.saveTokens({
        ...this.tokens,
        access_token: data.access_token,
        expires_at: data.expires_at || Date.now() + (data.expires_in || 3600) * 1000,
      })

      // Update gapi token
      if (window.gapi?.client) {
        window.gapi.client.setToken({
          access_token: data.access_token,
        })
      }

      return true
    } catch (error) {
      console.error('Token refresh error:', error)
      return false
    }
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.tokens) {
      throw new DriveError(DriveErrorCode.NOT_AUTHENTICATED, '인증되지 않았습니다')
    }

    if (this.isTokenExpired()) {
      const refreshed = await this.refreshAccessToken()
      if (!refreshed) {
        this._isConnected = false
        this.clearTokens()
        throw new DriveError(DriveErrorCode.TOKEN_EXPIRED, '세션이 만료되었습니다. 다시 연결해주세요.', true)
      }
    }
  }

  // Initialize Library
  async init(): Promise<void> {
    if (this.initialized) return

    if (!CLIENT_ID || !API_KEY) {
      throw new DriveError(DriveErrorCode.CONFIG_MISSING, 'Google Drive 설정이 누락되었습니다')
    }

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

      // initTokenClient - 초기 콜백에서 pendingAuthPromise 처리
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp: any) => {
          console.log('[GoogleDrive] OAuth callback received:', resp.error ? 'error' : 'success')

          if (resp.error) {
            console.error('[GoogleDrive] OAuth error:', resp)
            // 에러 처리
            if (this.pendingAuthPromise) {
              this.pendingAuthPromise.reject(mapApiError(resp))
              this.pendingAuthPromise = null
            }
            return
          }

          console.log('[GoogleDrive] OAuth success, saving tokens...')

          // 토큰 저장
          const newTokens: StoredTokens = {
            access_token: resp.access_token,
            expires_at: Date.now() + (resp.expires_in || 3600) * 1000,
            scope: resp.scope,
            token_type: resp.token_type,
          }
          this.saveTokens(newTokens)

          // gapi에 토큰 설정
          if (window.gapi?.client) {
            window.gapi.client.setToken(resp)
            console.log('[GoogleDrive] Token set to gapi client')
          }

          this._isConnected = true
          console.log('[GoogleDrive] Connection established, isConnected:', this.isConnected())

          // Pending Promise가 있으면 resolve 호출
          if (this.pendingAuthPromise) {
            this.pendingAuthPromise.resolve()
            this.pendingAuthPromise = null
          }
        },
        error_callback: (error: any) => {
          console.error('[GoogleDrive] OAuth error_callback:', error)
          if (this.pendingAuthPromise) {
            this.pendingAuthPromise.reject(
              new DriveError(DriveErrorCode.AUTH_CANCELLED, error?.message || '인증이 취소되었습니다')
            )
            this.pendingAuthPromise = null
          }
        },
      })

      // Try to restore saved tokens
      this.tokens = this.loadStoredTokens()
      if (this.tokens && !this.isTokenExpired()) {
        window.gapi.client.setToken({ access_token: this.tokens.access_token })
        this._isConnected = true
      } else if (this.tokens && this.isTokenExpired() && this.tokens.refresh_token) {
        // Try to refresh expired token
        const refreshed = await this.refreshAccessToken()
        if (refreshed) {
          this._isConnected = true
        } else {
          this.clearTokens()
        }
      }

      this.initialized = true
    } catch (error) {
      console.error('Google Drive Init Error:', error)
      throw error
    }
  }

  isConnected(): boolean {
    return this._isConnected && !!this.tokens?.access_token
  }

  async connect(): Promise<void> {
    if (!this.initialized) await this.init()

    // 이미 연결된 경우 바로 반환
    if (this.isConnected()) {
      console.log('[GoogleDrive] Already connected')
      return
    }

    // 이미 진행 중인 인증이 있으면 에러
    if (this.pendingAuthPromise) {
      throw new DriveError(DriveErrorCode.AUTH_IN_PROGRESS, '이미 인증이 진행 중입니다')
    }

    console.log('[GoogleDrive] Starting OAuth flow...')

    return new Promise<void>((resolve, reject) => {
      // 타임아웃 설정 (5분)
      const timeoutId = setTimeout(() => {
        if (this.pendingAuthPromise) {
          this.pendingAuthPromise = null
          reject(new DriveError(DriveErrorCode.NETWORK_ERROR, '인증 시간이 초과되었습니다', true))
        }
      }, 5 * 60 * 1000)

      // Pending Promise 저장 (타임아웃 클리어 포함)
      this.pendingAuthPromise = {
        resolve: () => {
          clearTimeout(timeoutId)
          resolve()
        },
        reject: (error: DriveError) => {
          clearTimeout(timeoutId)
          reject(error)
        },
      }

      // OAuth 팝업 요청
      this.tokenClient.requestAccessToken({ prompt: 'consent' })
    })
  }

  disconnect(): void {
    const token = this.tokens?.access_token || window.gapi?.client?.getToken()?.access_token
    if (token) {
      try {
        window.google.accounts.oauth2.revoke(token)
      } catch (e) {
        console.error('Failed to revoke token:', e)
      }
    }
    if (window.gapi?.client) {
      window.gapi.client.setToken(null)
    }
    this.clearTokens()
    this._isConnected = false
  }

  async listBackups(): Promise<DriveFile[]> {
    if (!this.isConnected()) {
      throw new DriveError(DriveErrorCode.NOT_AUTHENTICATED, '인증되지 않았습니다')
    }

    await this.ensureValidToken()

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
      throw mapApiError(error)
    }
  }

  async uploadBackup(
    data: string,
    fileName: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new DriveError(DriveErrorCode.NOT_AUTHENTICATED, '인증되지 않았습니다')
    }

    await this.ensureValidToken()

    const fileContent = data
    const file = new Blob([fileContent], { type: 'application/json' })
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
    }

    const accessToken = this.tokens?.access_token || window.gapi.client.getToken()?.access_token
    if (!accessToken) {
      throw new DriveError(DriveErrorCode.NOT_AUTHENTICATED, '액세스 토큰이 없습니다')
    }

    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', file)

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
          reject(mapApiError({ status: xhr.status, message: xhr.statusText }))
        }
      }

      xhr.onerror = () => reject(new DriveError(DriveErrorCode.NETWORK_ERROR, '네트워크 오류가 발생했습니다', true))
      xhr.send(form)
    })
  }

  async downloadBackup(fileId: string): Promise<string> {
    if (!this.isConnected()) {
      throw new DriveError(DriveErrorCode.NOT_AUTHENTICATED, '인증되지 않았습니다')
    }

    await this.ensureValidToken()

    try {
      const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      })

      return typeof response.body === 'string' ? response.body : JSON.stringify(response.result)
    } catch (error) {
      console.error('Download Backup Error:', error)
      throw mapApiError(error)
    }
  }

  async deleteBackup(fileId: string): Promise<void> {
    if (!this.isConnected()) {
      throw new DriveError(DriveErrorCode.NOT_AUTHENTICATED, '인증되지 않았습니다')
    }

    await this.ensureValidToken()

    try {
      await window.gapi.client.drive.files.delete({
        fileId: fileId,
      })
    } catch (error) {
      console.error('Delete Backup Error:', error)
      throw mapApiError(error)
    }
  }
}

export const googleDrive = new GoogleDriveService()
