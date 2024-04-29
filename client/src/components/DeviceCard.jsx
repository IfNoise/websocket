import { Alert, Box, Button, Card, CardActions, CardContent, CardHeader,Checkbox,CircularProgress,Dialog, FormControl, FormControlLabel, Radio, RadioGroup, Typography} from "@mui/material";
import PropTypes from "prop-types";
import OnlinePredictionIcon from '@mui/icons-material/OnlinePrediction';
import ErrorIcon from '@mui/icons-material/Error';
import DeviceSettingsList from "./DeviceSettingsList/DeviceSettingsList";
import { useGetStateQuery, useSetConfigMutation} from "../store/deviceApi";
import { useState } from "react";
import { on } from "ws";

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
  const{isLoading,isError,data}=useGetStateQuery(deviceId,{pollingInterval : updateInterval});

  return (
    <Box sx={{m:"5px",p:"5px",borderStyle:"solid",borderWidth:"1px",borderRadius:"4px"}}>
      <Typography variant="h6">Outputs</Typography>
    {isLoading && <CircularProgress/>}
    {isError && <Alert severity="error">{isError.message}</Alert>}
    {data &&data?.result?.outputs.map((output,i)=>(
      <Box key={i}  sx={{display:"inline",fontSize:"12px",width:"60px",m:"2px",p:"2px",height:"20px",borderRadius:"4px",borderStyle:"solid",borderColor: (output.state?"green":"red"),borderWidth:"2px"}} >{output.name}</Box> 
    ))}
    </Box>
  )
}
Outputs.propTypes={
  deviceId: PropTypes.string.isRequired,
  updateInterval: PropTypes.number.isRequired,
} 
const TimerMode=({mode,onChange})=>{
 const radioProps={
  size:"small",
 }
  return(
    <Box sx={{m:"5px",p:"5px",borderStyle:"solid",borderWidth:"1px",borderRadius:"4px"}}>
        <RadioGroup row aria-label="mode" name="mode" value={mode} onChange={onChange}>
          <FormControlLabel value={2} control={<Radio { ...radioProps} />} label="Auto" />
          <FormControlLabel value={1} control={<Radio {...radioProps} />} label="Manual" />
          <FormControlLabel value={0} control={<Radio {...radioProps} />} label="Off" />
        </RadioGroup>
      </Box>
  )
}
TimerMode.propTypes={
  mode: PropTypes.number.isRequired,
  onChange: PropTypes.func,
}
const IrrigatorCard=({name,config,onSave})=>{
  return (
    <Box sx={{m:"5px",p:"5px",borderStyle:"solid",borderWidth:"1px",borderRadius:"4px"}}>
    <Typography variant="h6">{config.name}</Typography>
    <Checkbox checked={config.enable} onChange={(e)=>{
      onSave({[name]:{enable:e.target.checked}},false)
    }}/>
    <TimerMode mode={config.mode} onChange={(e)=>{
      onSave({[name]:{mode:e.target.value}},false)
    }} />

    </Box>
  )
}
IrrigatorCard.propTypes={
  name: PropTypes.string.isRequired,
  config: PropTypes.object.isRequired,
  onSave: PropTypes.func.isRequired,
}

const DeviceCard = ({ device }) => {
  
  const [open, setOpen] = useState(false);
  const {id, address, status} = device;
  const [setConfig]=useSetConfigMutation();
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
        <Outputs deviceId={id} updateInterval={10000}/>
        {Object.keys(config).filter((key)=>key.startsWith("irr")).map((key,i)=>(
          <IrrigatorCard key={i} name={key} config={config[key]} onSave={(changes,reboot)=>setConfig({deviceId:id,params:{reboot,params:changes}})}/>
        ))}
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
        {config &&<DeviceSettingsList deviceId={id} onCancel={handleClose}/>}
    </Dialog> 
    </>
  );
}

DeviceCard.propTypes={
  device: PropTypes.object.isRequired,
}

export default DeviceCard;