import { Button, Card, CardActions, CardContent, CardHeader, Checkbox, Input, Slider, Stack, Typography } from "@mui/material";
import PropTypes from "prop-types";
import OnlinePredictionIcon from '@mui/icons-material/OnlinePrediction';
import ErrorIcon from '@mui/icons-material/Error';
import DeviceSettingsList from "./DeviceSettingsList/DeviceSettingsList";
import { useSetConfigMutation } from "../store/deviceApi";

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
  const {id, address, status} = device;
  const config = {...device.config};
  const saveChanges=(changes,reboot)=>{
    console.log("Saving changes", changes);
    setConfig({deviceId:id, reboot:reboot||false, params:changes})
    // .then((result)=>{
    //   console.log("Config update result", result);
    // });
  }
  return (
    <Card>
      <CardHeader avatar={<Status status={status}/> }  title={id} subheader={address} /> 
      <CardContent>

      {config &&<DeviceSettingsList config={config} onSave={saveChanges}/>}
      </CardContent>
    </Card>
  );
}

DeviceCard.propTypes={
  device: PropTypes.object.isRequired,
}

export default DeviceCard;