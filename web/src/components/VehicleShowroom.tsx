import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { X } from 'lucide-react'
import type { Lang } from '../i18n'
import { NasaModel } from './Models'

const ASSETS = [
  { id: 'apollo', file: 'lander.glb' as const, size: 7, fit: 'height' as const,
    en: 'Apollo Lunar Module', tr: 'Apollo Ay Modülü', origin: 'NASA · Moon lander', originTr: 'NASA · Ay iniş aracı' },
  { id: 'perseverance', file: 'rover.glb' as const, size: 3, fit: 'length' as const,
    en: 'Perseverance Rover', tr: 'Perseverance Gezgini', origin: 'NASA · Mars rover · visual proxy only', originTr: 'NASA · Mars gezgini · yalnızca görsel temsili' },
  { id: 'vikram', file: 'vikram.glb' as const, size: 2, fit: 'height' as const,
    en: 'Vikram lander (Chandrayaan-3)', tr: 'Vikram iniş aracı (Chandrayaan-3)', origin: 'ISRO · Moon lander · model by akareactor (CC-BY)', originTr: 'ISRO · Ay iniş aracı · model: akareactor (CC-BY)' },
  { id: 'pragyan', file: 'pragyan.glb' as const, size: 0.92, fit: 'length' as const,
    en: 'Pragyan rover', tr: 'Pragyan gezgini', origin: 'ISRO · Moon rover · model by Core.anim8 (CC-BY)', originTr: 'ISRO · Ay gezgini · model: Core.anim8 (CC-BY)' },
  { id: 'yutu', file: 'yutu.glb' as const, size: 1.5, fit: 'length' as const,
    en: 'Yutu-2 rover', tr: 'Yutu-2 gezgini', origin: 'CNSA · Moon rover · model by tashtego (CC-BY)', originTr: 'CNSA · Ay gezgini · model: tashtego (CC-BY)' },
  { id: 'starship', file: 'starship.glb' as const, size: 50, fit: 'height' as const,
    en: 'Starship HLS', tr: 'Starship HLS', origin: 'SpaceX · crewed Moon lander · model by MartianDays (CC-BY)', originTr: 'SpaceX · insanlı Ay iniş aracı · model: MartianDays (CC-BY)' },
  { id: 'lro', file: 'lro.glb' as const, size: 4, fit: 'max' as const,
    en: 'Lunar Reconnaissance Orbiter', tr: 'Lunar Reconnaissance Orbiter', origin: 'NASA · lunar orbiter', originTr: 'NASA · Ay yörünge aracı' },
] as const

function ModelStage({ id }: { id: number }) {
  const model = ASSETS[id]
  return (
    <Canvas camera={{ position: [10, 6, 11], fov: 34 }} dpr={[1, 1.6]}>
      <color attach="background" args={['#070b12']} />
      <fog attach="fog" args={['#070b12', 19, 38]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[7, 10, 5]} intensity={3.2} color="#fff2dc" />
      <directionalLight position={[-7, 4, -5]} intensity={1.5} color="#76a9e9" />
      <Stars radius={48} depth={24} count={900} factor={2.2} saturation={0.25} fade speed={0.3} />
      <gridHelper args={[22, 22, '#25354a', '#111d2a']} position={[0, -0.03, 0]} />
      <NasaModel file={model.file} size={6} fit={model.fit} shadows={false} />
      <OrbitControls makeDefault target={[0, 6 * 0.38, 0]} enablePan={false} minDistance={5} maxDistance={26} />
    </Canvas>
  )
}

export default function VehicleShowroom({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const [selected, setSelected] = useState(0)
  const tr = lang === 'tr'
  const asset = ASSETS[selected]
  return (
    <div className="vehicle-showroom-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="vehicle-showroom" role="dialog" aria-modal="true" aria-label={tr ? 'NASA 3D model galerisi' : 'NASA 3D model gallery'}>
        <header className="vehicle-showroom-head">
          <div><small>{tr ? 'UÇUŞ DONANIMI · 3D' : 'FLIGHT HARDWARE · 3D'}</small>
            <h2>{tr ? 'NASA model galerisi' : 'NASA model bay'}</h2></div>
          <button className="icon-btn" onClick={onClose} aria-label={tr ? 'Kapat' : 'Close'}><X size={18} /></button>
        </header>
        <div className="vehicle-showroom-view"><ModelStage id={selected} />
          <div className="vehicle-showroom-label"><b>{tr ? asset.tr : asset.en}</b><span>{tr ? asset.originTr : asset.origin}</span></div>
          <span className="vehicle-showroom-hint">{tr ? 'Döndürmek için sürükle · yakınlaştırmak için kaydır' : 'Drag to rotate · scroll to zoom'}</span>
        </div>
        <nav className="vehicle-showroom-tabs" aria-label={tr ? 'Modeller' : 'Models'}>
          {ASSETS.map((item, i) => <button key={item.id} className={selected === i ? 'on' : ''} onClick={() => setSelected(i)}>
            <span>0{i + 1}</span><b>{tr ? item.tr : item.en}</b><i>{i === 1 ? (tr ? 'Mars modeli' : 'MARS MODEL') : (tr ? 'NASA 3D' : 'NASA 3D')}</i>
          </button>)}
        </nav>
        <p className="vehicle-showroom-note">{tr
          ? 'Gerçek NASA GLB modelleri. Perseverance Mars gezginidir; LunaNav’da VIPER yerine kullanıldığı izlenimini vermemek için ayrı etiketlenmiştir.'
          : 'Real NASA GLB assets. Perseverance is a Mars rover; it is labeled clearly so it is not mistaken for VIPER or a lunar rover.'}</p>
      </section>
    </div>
  )
}
