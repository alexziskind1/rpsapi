import { PtUser } from './domain';
import { PtUserAuthInfo } from './pt-user-auth-info';

export interface PtUserWithAuth extends PtUser {
    authInfo?: PtUserAuthInfo;
}
