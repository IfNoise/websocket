import useFetch from "./hooks/useFetch"

function App() {
  const [data]=useFetch('http://192.168.31.250:3000/device')

  return (
    <>
      <div>
      {data&& Object.keys(data).map((device) => (
        <div key={device.id}>
          <h1>{device.config.device.name}</h1>
          <p>{device.config.device.id}</p>
          <p>{device.address}</p>
          <p>{device.status}</p>
        </div>
      ))}
      </div>
    </>
  )
}

export default App
