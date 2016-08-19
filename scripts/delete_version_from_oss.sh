#!/bin/bash

ROOT=$(cd "$(dirname "$0")/.."; pwd)
cd $ROOT

BUCKETROOT="btcstatic/wallet/www"
CMD="${ROOT}/scripts/OSS/osscmd"

if [[ $# -ne 1 ]]; then
    echo "[Usage] ${0} staticsdir"
    exit 1
fi

if [[ ! -e "$CMD" ]]; then
    echo "Missing osscmd, expected at ${CMD}"
    exit 1
fi

if [[ "${BTC_CDN_BUCKET_API_ID}" == "" ]]; then
    echo "BTC_CDN_BUCKET_API_ID should be set"
    exit 1
fi

if [[ "${BTC_CDN_BUCKET_API_KEY}" == "" ]]; then
    echo "BTC_CDN_BUCKET_API_KEY should be set"
    exit 1
fi

DELETEDIR=$1

if [[ "${DELETEDIR}" == "ls" ]]; then
    ${CMD} ls "oss://${BUCKETROOT}" --id=$BTC_CDN_BUCKET_API_ID --key=$BTC_CDN_BUCKET_API_KEY | \
        awk '{print $5}' | \
        grep "oss://${BUCKETROOT}" | \
        grep -oP 'www/.*?/' | grep -v "www/img" | grep -v "www/font" | sed 's/www\/\(.*\)\//\1/g' | \
        uniq
    exit 1
fi

${CMD} ls "oss://${BUCKETROOT}/${DELETEDIR}" --id=$BTC_CDN_BUCKET_API_ID --key=$BTC_CDN_BUCKET_API_KEY | \
    awk '{print $5}' | \
    grep "oss://${BUCKETROOT}/${DELETEDIR}" | \
    xargs -I {} echo "[" {} "]"


read -p "DELETE? "

${CMD} ls "oss://${BUCKETROOT}/${DELETEDIR}" --id=$BTC_CDN_BUCKET_API_ID --key=$BTC_CDN_BUCKET_API_KEY | \
    awk '{print $5}' | \
    grep "oss://${BUCKETROOT}/${DELETEDIR}" | \
    xargs -I {} ${CMD} rm --id=$BTC_CDN_BUCKET_API_ID --key=$BTC_CDN_BUCKET_API_KEY {}
