import {guestJson,GuestApiError} from '../../../lib/public-api.ts';
import {parseGarden} from '../stone-garden.ts';
export async function getPublicGarden(handle:string){if(!/^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(handle))throw new GuestApiError('response');return parseGarden(await guestJson(`blogs/${encodeURIComponent(handle)}/stone-garden`,new URLSearchParams(),process.env.NEXT_PUBLIC_API_BASE_URL,fetch));}
export async function getMyGarden(request:(path:string)=>Promise<unknown>){return parseGarden(await request('/members/me/stone-garden'));}
