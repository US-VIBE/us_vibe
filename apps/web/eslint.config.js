// Next.js 16+: `next lint` CLI가 제거되어 `next lint`는 `dev [directory]`로 잘못 해석됨.
// 공식 권장: eslint-config-next flat config + eslint 직접 실행.
// @see https://nextjs.org/docs/app/api-reference/config/eslint

module.exports = require("eslint-config-next");
