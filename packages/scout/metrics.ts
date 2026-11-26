export function quotaAlert(used:number,limit:number,thresholds=[70,85,95]){
 if(!Number.isFinite(used)||used<0||!Number.isFinite(limit)||limit<=0||thresholds.length!==3||thresholds.some((v,i)=>!Number.isFinite(v)||v<=0||v>100||(i>0&&v<=thresholds[i-1])))throw Error('Limites de monitoramento inválidos')
 const percent=used/limit*100
 return {used,limit,percent,level:percent>=thresholds[2]?'critical':percent>=thresholds[1]?'high':percent>=thresholds[0]?'warning':'normal'}
}
