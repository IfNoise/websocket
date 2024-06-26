import { Alert, Box, CircularProgress, Stack } from "@mui/material";
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
    <Box sx={{mt:"180px"}}>
      {!data && <CircularProgress /> }
      {data?.length === 0 && <Alert severity="info">No devices found</Alert>}
      <Stack direction="row" spacing={2}>
      {data && data.map((device) => (
        <DeviceCard key={device.id} device={device} />
      ))}
      </Stack>
    </Box>
  );
}
export default Dashboard;