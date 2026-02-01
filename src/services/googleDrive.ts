// ============================================
// Google Drive Service
// 큰 파일 방식 (Resumable Upload)
// ============================================

const API_BASE = '/api/drive'
const STORAGE_KEY = 'google-drive-tokens'

interface DriveTokens {
  access_token: string
  refresh_token?: string
  expires_at: number
}

interface DriveFile {
  id: string
  name: string
  size?: string
  createdTime?: string
  modifiedTime?: string
}

interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

class GoogleDriveService {
  private tokens: DriveTokens | null = null

  constructor() {
    this.loadTokens()
  }

  /**
   * localStorage에서 토큰 로드
   */
  private loadTokens(): void {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.tokens = JSON.parse(stored)
      }
    } catch {
      console.warn('[GoogleDrive] Failed to load tokens')
    }
  }

  /**
   * 토큰 저장
   */
  private saveTokens(tokens: DriveTokens): void {
    this.tokens = tokens
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return !!this.tokens?.access_token
  }

  /**
   * 연결 정보 가져오기
   */
  getConnectionInfo(): { connected: boolean; expiresAt?: Date } {
    if (!this.tokens) {
      return { connected: false }
    }
    return {
      connected: true,
      expiresAt: new Date(this.tokens.expires_at),
    }
  }

  /**
   * OAuth 인증 시작 (새 창에서)
   */
  connect(): void {
    const state = encodeURIComponent(window.location.pathname)
    window.location.href = `${API_BASE}/auth?state=${state}`
  }

  /**
   * 연결 해제
   */
  disconnect(): void {
    this.tokens = null
    localStorage.removeItem(STORAGE_KEY)
  }

  /**
   * 유효한 Access Token 가져오기 (필요시 갱신)
   */
  private async getValidAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('Not connected to Google Drive')
    }

    // 토큰 만료 5분 전에 갱신
    const expiresIn = this.tokens.expires_at - Date.now()
    if (expiresIn < 5 * 60 * 1000 && this.tokens.refresh_token) {
      await this.refreshToken()
    }

    return this.tokens.access_token
  }

  /**
   * 토큰 갱신
   */
  private async refreshToken(): Promise<void> {
    if (!this.tokens?.refresh_token) {
      throw new Error('No refresh token available')
    }

    const response = await fetch(`${API_BASE}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: this.tokens.refresh_token }),
    })

    if (!response.ok) {
      this.disconnect()
      throw new Error('Token refresh failed')
    }

    const data = await response.json()
    this.saveTokens({
      ...this.tokens,
      access_token: data.access_token,
      expires_at: data.expires_at,
    })
  }

  /**
   * 백업 파일 목록 조회
   */
  async listBackups(): Promise<DriveFile[]> {
    const accessToken = await this.getValidAccessToken()

    const response = await fetch(`${API_BASE}/list`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to list backups')
    }

    const data = await response.json()
    return data.files || []
  }

  /**
   * 백업 업로드 (Resumable Upload)
   */
  async uploadBackup(
    data: string,
    fileName: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<DriveFile> {
    const accessToken = await this.getValidAccessToken()
    const blob = new Blob([data], { type: 'application/json' })

    // 1. 업로드 URL 요청
    const urlResponse = await fetch(`${API_BASE}/upload-url`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        mimeType: 'application/json',
        fileSize: blob.size,
      }),
    })

    if (!urlResponse.ok) {
      const error = await urlResponse.json()
      throw new Error(error.details || 'Failed to get upload URL')
    }

    const { uploadUrl } = await urlResponse.json()

    // 2. 클라이언트에서 직접 Google Drive로 업로드
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          })
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const file = JSON.parse(xhr.responseText)
            resolve(file)
          } catch {
            resolve({ id: 'unknown', name: fileName })
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error('Upload failed'))

      xhr.open('PUT', uploadUrl, true)
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.send(blob)
    })
  }

  /**
   * 백업 다운로드
   */
  async downloadBackup(fileId: string): Promise<string> {
    const accessToken = await this.getValidAccessToken()

    const response = await fetch(`${API_BASE}/download?fileId=${fileId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to download backup')
    }

    return response.text()
  }

  /**
   * 백업 삭제
   */
  async deleteBackup(fileId: string): Promise<void> {
    const accessToken = await this.getValidAccessToken()

    const response = await fetch(`${API_BASE}/delete?fileId=${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to delete backup')
    }
  }
}

// 싱글톤 인스턴스
export const googleDrive = new GoogleDriveService()

export type { DriveFile, UploadProgress }
