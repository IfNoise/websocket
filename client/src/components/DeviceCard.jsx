import { Button, Card, CardActions, CardContent, CardHeader,CircularProgress,Dialog} from "@mui/material";
import PropTypes from "prop-types";
import OnlinePredictionIcon from '@mui/icons-material/OnlinePrediction';
import ErrorIcon from '@mui/icons-material/Error';
import DeviceSettingsList from "./DeviceSettingsList/DeviceSettingsList";
import { useGetStateQuery} from "../store/deviceApi";
import { useState } from "react";

const Status=({status})=>{
 switch(status){ 
    case "connected":
      return <OnlinePredictionIcon color="success"/>  
    case "disconnected":
      return <OnlinePredictionIcon color="gray"/>
    case "error":
      return <ErrorIcon color="red"/>
    default:
      return <OnlinePredictionIcon color="gray"/>
}
}
Status.propTypes={
  status: PropTypes.string.isRequired,
}
const Outputs=({deviceId,updateInterval})=>{
  const{isLoading,isSuccess,data}=useGetStateQuery(deviceId,{pollingInterval : updateInterval});
  if(isLoading){
    return <CircularProgress/>
  }
  if(isSuccess){
    return data.map((output,id)=>(
      <pre key={id}>{JSON.stringify(output)}</pre>
    ))
  }
}
Outputs.propTypes={
  deviceId: PropTypes.string.isRequired,
  updateInterval: PropTypes.number.isRequired,
} 

const DeviceCard = ({ device }) => {
  
  const [open, setOpen] = useState(false);
  const {id, address, status} = device;
  const config = {...device.config};
  const handleClose = () => {
    setOpen(false);
  };
  const handleOpen = () => {
    setOpen(true);
  }
  return (
    <>
    <Card>
      <CardHeader avatar={<Status status={status}/> }  title={id} subheader={address} /> 
      <CardContent>
        <Outputs deviceId={id} updateInterval={5000}/>
      
      </CardContent>
      <CardActions>
        <Button onClick={handleOpen}>Settings</Button>
      </CardActions>
    </Card>
    <Dialog
        fullScreen
        open={open}
        onClose={handleClose}
      >
        {config &&<DeviceSettingsList config={config} onCancel={handleClose}/>}
    </Dialog> 
    </>
  );
}

DeviceCard.propTypes={
  device: PropTypes.object.isRequired,
}

export default DeviceCard;