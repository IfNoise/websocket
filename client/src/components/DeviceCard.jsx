import { Button, Card, CardActions, CardContent, CardHeader,Dialog} from "@mui/material";
import PropTypes from "prop-types";
import OnlinePredictionIcon from '@mui/icons-material/OnlinePrediction';
import ErrorIcon from '@mui/icons-material/Error';
import DeviceSettingsList from "./DeviceSettingsList/DeviceSettingsList";
import { useSetConfigMutation } from "../store/deviceApi";
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

const DeviceCard = ({ device }) => {
  const[setConfig]=useSetConfigMutation();
  const [open, setOpen] = useState(false);
  const {id, address, status} = device;
  const config = {...device.config};
  const saveChanges=(changes,reboot)=>{
    console.log("Saving changes", changes);
    setConfig({deviceId:id, reboot:reboot||false, params:changes})
    handleClose();
  }
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
        {config &&<DeviceSettingsList config={config} onSave={saveChanges} onCancel={handleClose}/>}
    </Dialog> 
    </>
  );
}

DeviceCard.propTypes={
  device: PropTypes.object.isRequired,
}

export default DeviceCard;