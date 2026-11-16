import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ready } from './cloud/bootstrap.js'
import { externalConnectionsAllowed } from './cloud/client.js'

ready.then(() => {
  createRoot(document.getElementById('root')).render(<StrictMode>{externalConnectionsAllowed ? <App /> : <main><h1>외부 연결이 중지된 검증 화면</h1><p>이 환경에서는 로그인·데이터 조회·저장·외부 알림을 사용할 수 없습니다.</p></main>}</StrictMode>)
}).catch(() => {})
