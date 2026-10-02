import {pilotDestination} from './invite.mjs';
const role=document.body.dataset.role;
for(const link of document.querySelectorAll('[data-join]'))link.href=pilotDestination(role,location.search);
