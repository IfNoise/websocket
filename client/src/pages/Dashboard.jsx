import { Alert, Box, CircularProgress } from "@mui/material";
import DeviceCard from "../components/DeviceCard";
import { useGetDevicesQuery } from "../store/deviceApi";

const Dashboard = () => {
  const { isLoading, isError, error, data,refetch }=useGetDevicesQuery({refetchOnReconnect:true,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true});
  if (data?.length === 0) {
    return <Alert severity="info">No devices found</Alert>;
  }
  return (
    <Box sx={{position:"absolute",top:120,bottom:0}}>
      {!data && <CircularProgress /> }
      {data?.length === 0 && <Alert severity="info">No devices found</Alert>}
      {data && data.map((device) => (
        <DeviceCard key={device.id} device={device} />
      ))}
    </Box>
  );
}
export default Dashboard;