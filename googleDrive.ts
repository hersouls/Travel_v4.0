import type { BackupFile } from './backup'

// Configuration
const CLIENT_ID = '918814780081-cu6o0krg6d7ihmnspjbe1nsi272t695j.apps.googleusercontent.com'
// NOTE: You must create an API Key in Google Cloud Console > Credentials and paste it here.
// The "Client Secret" (GOCSPX-...) is NOT the API Key and is not needed for this client-side app.
const API_KEY = 'AIzaSyAxfac7PrWNus6b7xxUGM3irAk_xO-a4vY'

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

// Global gapi and google types
declare global {
    interface Window {
        gapi: any
        google: any
    }
}

let tokenClient: any

export async function loadGoogleScript(): Promise<void> {
    return new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = 'https://apis.google.com/js/api.js'
        script.onload = () => resolve()
        document.body.appendChild(script)
    })
}

export async function loadGisScript(): Promise<void> {
    return new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.onload = () => resolve()
        document.body.appendChild(script)
    })
}

export async function initializeGoogleApi(): Promise<void> {
    await Promise.all([loadGoogleScript(), loadGisScript()])

    return new Promise((resolve, reject) => {
        window.gapi.load('client', async () => {
            try {
                await window.gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: [DISCOVERY_DOC],
                })

                tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: '', // defined later
                })
                resolve()
            } catch (err) {
                reject(err)
            }
        })
    })
}

export async function handleAuthClick(): Promise<void> {
    if (!getToken()) {
        return new Promise((resolve, reject) => {
            tokenClient.callback = async (resp: any) => {
                if (resp.error) {
                    reject(resp)
                }
                resolve()
            }
            if (window.gapi.client.getToken() === null) {
                tokenClient.requestAccessToken({ prompt: 'consent' })
            } else {
                tokenClient.requestAccessToken({ prompt: '' })
            }
        })
    }
}

export function handleSignoutClick() {
    const token = window.gapi.client.getToken()
    if (token !== null) {
        window.google.accounts.oauth2.revoke(token.access_token)
        window.gapi.client.setToken('')
    }
}

export function getToken() {
    return window.gapi?.client?.getToken()
}

export async function uploadBackupToDrive(backupData: BackupFile, filename: string = 'moonwave_backup.json'): Promise<string> {
    if (!getToken()) throw new Error('Not authenticated')

    const fileContent = JSON.stringify(backupData)
    const file = new Blob([fileContent], { type: 'application/json' })
    const metadata = {
        name: filename,
        mimeType: 'application/json',
        // parents: ['appDataFolder'] // Optional: Use appDataFolder to hide from user
    }

    const accessToken = window.gapi.client.getToken().access_token
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', file)

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
        body: form,
    })

    const data = await response.json()
    return data.id
}

export async function listBackups() {
    if (!getToken()) throw new Error('Not authenticated')

    const response = await window.gapi.client.drive.files.list({
        pageSize: 10,
        fields: 'files(id, name, createdTime)',
        q: "name contains 'moonwave_backup' and trashed=false",
        orderBy: 'createdTime desc'
    });
    return response.result.files;
}

export async function downloadBackupFromDrive(fileId: string): Promise<BackupFile> {
    if (!getToken()) throw new Error('Not authenticated')

    const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
    });

    return response.result as BackupFile // gapi parses JSON automatically
}
