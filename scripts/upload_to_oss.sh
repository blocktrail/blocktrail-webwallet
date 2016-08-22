#!/bin/bash

ROOT=$(cd "$(dirname "$0")/.."; pwd)
cd $ROOT

JQVERSION=$(jq --version)
if [[ $JQVERSION != "jq-1.5" ]]; then
    echo "Need JQ version 1.5!"
    exit 1
fi

STATICSDIR=$(gulp appconfig:print --silent | jq -r '.STATICSDIR')

if [[ "${STATICSDIR}" == "dev" ]]; then
    echo "Won't upload \`dev\` dir!"
    exit 1
fi
if [[ "${STATICSDIR}" == "" ]]; then
    echo "Failed to determine staticsdir!"
    exit 1
fi


BUILD="${ROOT}/www/${STATICSDIR}"
BUCKET="btcstatic/wallet"
BUCKETDIR="${BUCKET}/www/${STATICSDIR}"
CMD="${ROOT}/scripts/OSS/osscmd"

if [[ $# -ne 0 ]]; then
    echo "[Usage] ${0}"
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

if [[ ! -e "$CMD" ]]; then
    echo "Missing osscmd, expected at ${CMD}"
    exit 1
fi

if [[ ! -e "$BUILD" ]]; then
    echo "Can't find builddir: ${BUILD}"
    exit 1
fi

echo " == VERSIONED == \n"
echo "${CMD} uploadfromdir ${BUILD} \"oss://${BUCKETDIR}\" --check_md5=true --thread_num=20 --replace=false --id=${BTC_CDN_BUCKET_API_ID} --key=${BTC_CDN_BUCKET_API_KEY}"
read -p "GO? "
$CMD uploadfromdir $BUILD "oss://${BUCKETDIR}" --check_md5=true --thread_num=20 --replace=false --id=${BTC_CDN_BUCKET_API_ID} --key=${BTC_CDN_BUCKET_API_KEY}


echo " == NON VERSIONED == \n"
echo "${CMD} uploadfromdir ${ROOT}/www/img \"oss://${BUCKET}/www/img\" --check_md5=true --thread_num=20 --replace=false --id=${BTC_CDN_BUCKET_API_ID} --key=${BTC_CDN_BUCKET_API_KEY}"
$CMD uploadfromdir ${ROOT}/www/img "oss://${BUCKET}/www/img" --check_md5=true --thread_num=20 --replace=false --id=${BTC_CDN_BUCKET_API_ID} --key=${BTC_CDN_BUCKET_API_KEY}

echo "${CMD} uploadfromdir ${ROOT}/www/font \"oss://${BUCKET}/www/font\" --check_md5=true --thread_num=20 --replace=false --id=${BTC_CDN_BUCKET_API_ID} --key=${BTC_CDN_BUCKET_API_KEY}"
$CMD uploadfromdir ${ROOT}/www/font "oss://${BUCKET}/www/font" --check_md5=true --thread_num=20 --replace=false --id=${BTC_CDN_BUCKET_API_ID} --key=${BTC_CDN_BUCKET_API_KEY}

echo "${CMD} upload ${ROOT}/www/favicon.ico \"oss://${BUCKET}/www/favicon.ico\" --check_md5=true --thread_num=20 --replace=false --id=${BTC_CDN_BUCKET_API_ID} --key=${BTC_CDN_BUCKET_API_KEY}"
$CMD upload ${ROOT}/www/favicon.ico "oss://${BUCKET}/www/favicon.ico" --check_md5=true --thread_num=20 --replace=false --id=${BTC_CDN_BUCKET_API_ID} --key=${BTC_CDN_BUCKET_API_KEY}
