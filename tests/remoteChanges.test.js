import { describe, it, expect } from 'vitest';
import { shouldWarnAboutRemoteChange } from '../src/cloud/remoteChanges';
describe('remote change notices',()=>{
  const theme={userId:'owner',namespace:'settings',key:'cxr542-portal-theme'};
  it('keeps integrated theme changes from invalidating tool document drafts',()=>{
    expect(shouldWarnAboutRemoteChange(theme,'owner',true)).toBe(false);
    expect(shouldWarnAboutRemoteChange(theme,'owner',false)).toBe(true);
    expect(shouldWarnAboutRemoteChange({...theme,namespace:'idea-bank',key:'draft'},'owner',true)).toBe(true);
    expect(shouldWarnAboutRemoteChange({...theme,key:'another-setting'},'owner',true)).toBe(true);
  });
  it('ignores malformed or other-account notifications',()=>{
    expect(shouldWarnAboutRemoteChange(theme,'someone-else',true)).toBe(false);
    expect(shouldWarnAboutRemoteChange(null,'owner',true)).toBe(false);
    expect(shouldWarnAboutRemoteChange({userId:'owner'},'owner',true)).toBe(false);
  });
});
